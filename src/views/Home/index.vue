<script setup lang="ts">
import { ref, onMounted, onUnmounted, } from 'vue'
import PrizeList from './PrizeList.vue'
import { useElementStyle, useElementPosition } from '@/hooks/useElement'
import StarsBackground from '@/components/StarsBackground/index.vue'
import confetti from 'canvas-confetti'
import { filterData, selectCard } from '@/utils'
import { rgba } from '@/utils/color'
import { IPersonConfig } from '@/types/storeType'
// import * as THREE from 'three'
import { Scene, PerspectiveCamera, Object3D, Vector3 } from 'three'
// import {
//     CSS3DRenderer, CSS3DObject
// } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { CSS3DRenderer, CSS3DObject } from 'three-css3d'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
// import TrackballControls from 'three-trackballcontrols';
// import TWEEN from 'three/examples/jsm/libs/tween.module.js';
import * as TWEEN from '@tweenjs/tween.js'
import useStore from '@/store'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toast-notification';
import { provisionalWinners, rollbackWinners, updatePrizeUsage, mapWinnersPayload } from '@/api/winner'
import 'vue-toast-notification/dist/theme-sugar.css';

const toast = useToast();
const router = useRouter()
const personConfig = useStore().personConfig
const globalConfig = useStore().globalConfig
const prizeConfig = useStore().prizeConfig

const { getAllPersonList: allPersonList, getNotPersonList: notPersonList, getNotThisPrizePersonList: notThisPrizePersonList } = storeToRefs(personConfig)
const { getCurrentPrize: currentPrize } = storeToRefs(prizeConfig)
const { getTopTitle: topTitle, getCardColor: cardColor, getPatterColor: patternColor, getPatternList: patternList, getTextColor: textColor, getLuckyColor: luckyColor, getCardSize: cardSize, getTextSize: textSize, getRowCount: rowCount, getIsShowPrizeList: isShowPrizeList } = storeToRefs(globalConfig)
const tableData = ref<any[]>([])
// const tableData = ref<any[]>(JSON.parse(JSON.stringify(alreadyPersonList.value)).concat(JSON.parse(JSON.stringify(notPersonList.value))))
const currentStatus = ref(0) // 0为初始状态， 1为抽奖准备状态，2为抽奖中状态，3为抽奖结束状态
const ballRotationY = ref(0)
const containerRef = ref<HTMLElement>()
// const LuckyViewRef= ref()
const canOperate = ref(true)
const cameraZ = ref(3000)
const prizeListRef = ref()

const scene = ref()
const camera = ref()
const renderer = ref()
const controls = ref()
const objects = ref<any[]>([])

const targets = {
    grid: <any[]>[],
    helix: <any[]>[],
    table: <any[]>[],
    sphere: <any[]>[]
};

const luckyTargets = ref<any[]>([])
const luckyCardList = ref<number[]>([])
let luckyCount = ref(10)
const personPool = ref<IPersonConfig[]>([])

const intervalTimer = ref<any>(null)
// const currentPrizeValue = ref(JSON.parse(JSON.stringify(currentPrize.value)))
// 礼花开关：仅在抽取完成时触发一次，继续后不再触发
let enableConfetti = true

// 红包雨：Canvas 引擎与实例
const packetCanvasRef = ref<HTMLCanvasElement | null>(null)
let packetRain: any = null
let packetRunning = false

function initPacketRain() {
    if (!packetCanvasRef.value) return
    const canvas = packetCanvasRef.value
    const ctx = canvas.getContext('2d')!
    let width = 0, height = 0, dpr = Math.min(window.devicePixelRatio || 1, 2)
    const active: any[] = []
    const pool: any[] = []
    let lastTs = 0
    let spawnAcc = 0

    const config = {
        gravity: 1400,
        spawnPerSecond: 120,
        maxConcurrent: 200,
        minSize: 28,
        maxSize: 64,
        baseSpeedMin: 300,
        baseSpeedMax: 600,
        windAmplitude: 50,
        windFrequency: 1.2
    }

    function resize() {
        const rect = canvas.getBoundingClientRect()
        width = rect.width
        height = rect.height
        canvas.width = Math.floor(width * dpr)
        canvas.height = Math.floor(height * dpr)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    function rand(a: number, b: number) { return a + Math.random() * (b - a) }

    function spawn(ts: number) {
        const size = rand(config.minSize, config.maxSize)
        const obj = pool.pop() || {}
        obj.w = size
        obj.h = size * 1.2
        obj.x = rand(size * 0.5, width - size * 0.5)
        obj.y = -obj.h - rand(0, height * 0.25)
        obj.vx = 0
        obj.vy = rand(config.baseSpeedMin, config.baseSpeedMax)
        obj.windPhase = Math.random() * Math.PI * 2
        obj.windAmp = config.windAmplitude * (0.6 + Math.random() * 0.8)
        obj.windFreq = config.windFrequency * (0.7 + Math.random() * 0.6)
        obj.rotate = rand(-12, 12) * Math.PI / 180
        obj.rotateSpeed = rand(-30, 30) * Math.PI / 180
        obj.state = 'fall'
        active.push(obj)
    }

    function recycle(i: number) {
        const o = active[i]
        if (!o) return
        active.splice(i, 1)
        pool.push(o)
    }

    function roundRectPath(x: number, y: number, w: number, h: number, r: number) {
        const rr = Math.min(r, w / 2, h / 2)
        ctx.beginPath()
        ctx.moveTo(x + rr, y)
        ctx.lineTo(x + w - rr, y)
        ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
        ctx.lineTo(x + w, y + h - rr)
        ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
        ctx.lineTo(x + rr, y + h)
        ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
        ctx.lineTo(x, y + rr)
        ctx.quadraticCurveTo(x, y, x + rr, y)
        ctx.closePath()
    }

    function drawPacket(p: any) {
        const { x, y, w, h, rotate, state } = p
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(rotate)
        const scale = state === 'hit' ? 0.9 : 1
        ctx.scale(scale, scale)

        const r = Math.min(14, Math.min(w, h) * 0.22)
        const W = w, H = h
        const grd = ctx.createLinearGradient(-W/2, -H/2, W/2, H/2)
        grd.addColorStop(0, '#ff3b30')
        grd.addColorStop(1, '#ff6a39')
        ctx.fillStyle = grd
        roundRectPath(-W/2, -H/2, W, H, r)
        ctx.fill()

        ctx.fillStyle = '#FFD66B'
        ctx.beginPath()
        ctx.arc(0, -H * 0.05, H * 0.16, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#A45B00'
        ctx.font = `${Math.floor(H * 0.18)}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('¥', 0, -H * 0.05)
        ctx.restore()
    }

    function tick(ts: number) {
        if (!packetRunning) return
        if (!lastTs) lastTs = ts
        const dt = Math.min(0.033, (ts - lastTs) / 1000)
        lastTs = ts

        // spawn
        spawnAcc += dt * config.spawnPerSecond
        const canSpawn = Math.max(0, config.maxConcurrent - active.length)
        let toSpawn = Math.min(canSpawn, Math.floor(spawnAcc))
        while (toSpawn-- > 0) spawn(ts)
        spawnAcc -= Math.floor(spawnAcc)

        ctx.clearRect(0, 0, width, height)
        const time = ts / 1000
        for (let i = active.length - 1; i >= 0; i--) {
            const p = active[i]
            const sway = Math.sin(time * p.windFreq * 2 * Math.PI + p.windPhase) * p.windAmp
            p.rotate += p.rotateSpeed * dt
            p.vy += 1400 * dt
            p.x += (sway) * 0.05
            p.y += p.vy * dt
            if (p.y - p.h / 2 > height + 20) { recycle(i); continue }
            drawPacket(p)
        }
        requestAnimationFrame(tick)
    }

    function start() {
        if (packetRunning) return
        packetRunning = true
        lastTs = 0
        spawnAcc = 0
        resize()
        requestAnimationFrame(tick)
    }
    function stop() {
        packetRunning = false
        active.length = 0
        ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    window.addEventListener('resize', resize, { passive: true })
    packetRain = { start, stop, resize }
}

function startPacketRain() {
    if (!packetRain) initPacketRain()
    packetRain && packetRain.start()
    // 隐藏背景卡片层（使用 display 防止继承/层叠问题）
    try {
        if (renderer.value?.domElement) {
            renderer.value.domElement.style.display = 'none'
        }
    } catch (e) {}
}
function stopPacketRain() {
    packetRain && packetRain.stop()
    // 恢复背景卡片层
    try {
        if (renderer.value?.domElement) {
            renderer.value.domElement.style.display = ''
        }
    } catch (e) {}
}

// 仅显示中奖卡片，隐藏其他背景卡片
function hideBackgroundCards() {
    if (!objects.value?.length) return
    const luckySet = new Set(luckyCardList.value)
    for (let i = 0; i < objects.value.length; i++) {
        const el = objects.value[i]?.element as HTMLElement | undefined
        if (!el) continue
        if (!luckySet.has(i)) {
            el.style.visibility = 'hidden'
        } else {
            el.style.visibility = 'visible'
        }
    }
}

function showAllCards() {
    if (!objects.value?.length) return
    for (let i = 0; i < objects.value.length; i++) {
        const el = objects.value[i]?.element as HTMLElement | undefined
        if (!el) continue
        el.style.visibility = 'visible'
    }
}

// 将中奖卡片从前景位置动画返回到表格位置
function returnWinnersToTable(): Promise<void> {
    return new Promise((resolve) => {
        if (!luckyCardList.value.length) {
            resolve()
            return
        }
        let finished = 0
        const total = luckyCardList.value.length
        for (let i = 0; i < luckyCardList.value.length; i++) {
            const cardIndex = luckyCardList.value[i]
            const item = objects.value[cardIndex]
            const targetPos = targets.table[cardIndex]?.position
            if (!item || !targetPos) {
                finished++
                if (finished >= total) resolve()
                continue
            }
            new TWEEN.Tween(item.position)
                .to({ x: targetPos.x, y: targetPos.y, z: 0 }, 700)
                .easing(TWEEN.Easing.Exponential.InOut)
                .onStart(() => {
                    // 还原卡片样式尺寸为普通卡
                    item.element = useElementStyle(
                        item.element,
                        {} as any,
                        cardIndex,
                        patternList.value,
                        patternColor.value,
                        cardColor.value,
                        { width: cardSize.value.width, height: cardSize.value.height },
                        textSize.value,
                        'default'
                    )
                })
                .onUpdate(render)
                .start()
                .onComplete(() => {
                    finished++
                    if (finished >= total) resolve()
                })
        }
    })
}

// 填充数据，填满七行
function initTableData() {
    if (notPersonList.value.length <= 0) {
        return
    }
    const totalCount = rowCount.value * 7
    const orginPersonData = JSON.parse(JSON.stringify(notPersonList.value))
    const orginPersonLength = orginPersonData.length
    if (orginPersonLength < totalCount) {
        const repeatCount = Math.ceil(totalCount / orginPersonLength)
        // 复制数据
        for (let i = 0; i < repeatCount; i++) {
            tableData.value = tableData.value.concat(JSON.parse(JSON.stringify(orginPersonData)))
        }
    }
    else{
        tableData.value=orginPersonData.slice(0, totalCount)
    }
    tableData.value = filterData(tableData.value.slice(0, totalCount), rowCount.value)
}
const init = () => {
    const felidView = 40;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    const nearPlane = 1;
    const farPlane = 10000;
    const WebGLoutput = containerRef.value

    scene.value = new Scene();
    camera.value = new PerspectiveCamera(felidView, aspect, nearPlane, farPlane);
    camera.value.position.z = cameraZ.value
    renderer.value = new CSS3DRenderer()
    renderer.value.setSize(width, height * 0.9)
    renderer.value.domElement.style.position = 'absolute';
    // 垂直居中
    renderer.value.domElement.style.paddingTop = '50px'
    renderer.value.domElement.style.top = '50%';
    renderer.value.domElement.style.left = '50%';
    renderer.value.domElement.style.transform = 'translate(-50%, -50%)';
    WebGLoutput!.appendChild(renderer.value.domElement);

    controls.value = new TrackballControls(camera.value, renderer.value.domElement);
    controls.value.rotateSpeed = 1;
    controls.value.staticMoving = true;
    controls.value.minDistance = 500;
    controls.value.maxDistance = 6000;
    controls.value.addEventListener('change', render);

    const tableLen = tableData.value.length
    for (let i = 0; i < tableLen; i++) {
        let element = document.createElement('div');
        element.className = 'element-card';

        const number = document.createElement('div');
        number.className = 'card-id';
        number.textContent = tableData.value[i].uid;
        element.appendChild(number);

        const symbol = document.createElement('div');
        symbol.className = 'card-name';
        symbol.textContent = tableData.value[i].name;
        element.appendChild(symbol);

        const detail = document.createElement('div');
        detail.className = 'card-detail';
        detail.innerHTML = `${tableData.value[i].department}<br/>${tableData.value[i].identity}`;
        element.appendChild(detail);

        element = useElementStyle(element, tableData.value[i], i, patternList.value, patternColor.value, cardColor.value, cardSize.value, textSize.value)
        const object = new CSS3DObject(element);
        object.position.x = Math.random() * 4000 - 2000;
        object.position.y = Math.random() * 4000 - 2000;
        object.position.z = Math.random() * 4000 - 2000;
        scene.value.add(object);

        objects.value.push(object);
    }

    createTableVertices();
    createSphereVertices();
    createHelixVertices();

    function createTableVertices() {
        const tableLen = tableData.value.length;

        for (let i = 0; i < tableLen; i++) {
            const object = new Object3D();

            object.position.x = tableData.value[i].x * (cardSize.value.width + 40) - rowCount.value * 90;
            object.position.y = -tableData.value[i].y * (cardSize.value.height + 20) + 1000;
            object.position.z = 0;

            targets.table.push(object);
        }
    }

    function createSphereVertices() {
        let i = 0;
        const objLength = objects.value.length;
        const vector = new Vector3();

        for (; i < objLength; ++i) {
            let phi = Math.acos(-1 + (2 * i) / objLength);
            let theta = Math.sqrt(objLength * Math.PI) * phi;
            const object = new Object3D();

            object.position.x = 800 * Math.cos(theta) * Math.sin(phi);
            object.position.y = 800 * Math.sin(theta) * Math.sin(phi);
            object.position.z = -800 * Math.cos(phi);

            // rotation object 

            vector.copy(object.position).multiplyScalar(2);
            object.lookAt(vector);
            targets.sphere.push(object);
        }
    }
    function createHelixVertices() {
        let i = 0;
        const vector = new Vector3();
        const objLength = objects.value.length;
        for (; i < objLength; ++i) {
            let phi = i * 0.213 + Math.PI;

            const object = new Object3D();

            object.position.x = 800 * Math.sin(phi);
            object.position.y = -(i * 8) + 450;
            object.position.z = 800 * Math.cos(phi + Math.PI);

            object.scale.set(1.1, 1.1, 1.1);

            vector.x = object.position.x * 2;
            vector.y = object.position.y;
            vector.z = object.position.z * 2;

            object.lookAt(vector);

            targets.helix.push(object);
        }
    }
    window.addEventListener('resize', onWindowResize, false);
    transform(targets.table, 1000)
    render();
}

const transform = (targets: any[], duration: number) => {
    TWEEN.removeAll();
    if (intervalTimer.value) {
        clearInterval(intervalTimer.value);
        intervalTimer.value = null
        randomBallData('sphere')
    }

    return new Promise((resolve) => {
        const objLength = objects.value.length;
        for (let i = 0; i < objLength; ++i) {
            let object = objects.value[i];
            let target = targets[i];
            new TWEEN.Tween(object.position)
                .to({ x: target.position.x, y: target.position.y, z: target.position.z },
                    Math.random() * duration + duration)
                .easing(TWEEN.Easing.Exponential.InOut)
                .start();


            new TWEEN.Tween(object.rotation)
                .to({ x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration)
                .easing(TWEEN.Easing.Exponential.InOut)
                .start()
                .onComplete(() => {
                    if (luckyCardList.value.length) {
                        luckyCardList.value.forEach((cardIndex: any) => {
                            const item = objects.value[cardIndex]
                            useElementStyle(item.element, {} as any, i, patternList.value, patternColor.value, cardColor.value, cardSize.value, textSize.value, 'sphere')
                        })
                    }
                    luckyTargets.value = [];
                    luckyCardList.value = [];

                    canOperate.value = true
                });
        }

        // 这个补间用来在位置与旋转补间同步执行，通过onUpdate在每次更新数据后渲染scene和camera
        new TWEEN.Tween({})
            .to({}, duration * 2)
            .onUpdate(render)
            .start()
            .onComplete(() => {
                canOperate.value = true
                resolve('')
            });
    })
}
function onWindowResize() {
    camera.value.aspect = window.innerWidth / window.innerHeight
    camera.value.updateProjectionMatrix();

    renderer.value.setSize(window.innerWidth, window.innerHeight);
    render();
}

/**
* [animation update all tween && controls]
*/
function animation() {
    // 始终更新补间以确保中奖动画正常
    TWEEN.update();
    // 渲染层隐藏/结果阶段/红包雨中时，暂停重的控制器更新，减少开销
    const rendererHidden = !!(renderer.value?.domElement && (renderer.value.domElement.style.display === 'none'))
    const inResults = currentStatus.value === 3
    if (!rendererHidden && !packetRunning && !inResults) {
        controls.value.update();
    }
    // 设置自动旋转
    // 设置相机位置
    requestAnimationFrame(animation);
}

// // 旋转的动画
function rollBall(rotateY: number, duration: number) {
    TWEEN.removeAll();

    return new Promise((resolve) => {
        scene.value.rotation.y = 0;
        ballRotationY.value = Math.PI * rotateY * 1000
        const rotateObj = new TWEEN.Tween(scene.value.rotation);
        rotateObj
            .to(
                {
                    // x: Math.PI * rotateX * 1000,
                    x: 0,
                    y: ballRotationY.value,
                    // z: Math.PI * rotateZ * 1000
                    z: 0
                },
                duration * 1000
            )
            .onUpdate(render)
            .start()
            .onStop(() => {
                resolve('')
            })
            .onComplete(() => {
                resolve('')
            })
    })
}
// 将视野转回正面
function resetCamera() {
    new TWEEN.Tween(camera.value.position)
        .to(
            {
                x: 0,
                y: 0,
                z: 3000
            },
            1000
        )
        .onUpdate(render)
        .start()
        .onComplete(() => {
            new TWEEN.Tween(camera.value.rotation)
                .to(
                    {
                        x: 0,
                        y: 0,
                        z: 0
                    },
                    1000
                )
                .onUpdate(render)
                .start()
                .onComplete(() => {
                    canOperate.value = true
                    // camera.value.lookAt(scene.value.position)
                    camera.value.position.y = 0
                    camera.value.position.x = 0
                    camera.value.position.z = 3000
                    camera.value.rotation.x = 0
                    camera.value.rotation.y = 0
                    camera.value.rotation.z = -0
                    controls.value.reset()
                })
        })
}

function render() {
    renderer.value.render(scene.value, camera.value);
}
const enterLottery = async () => {
    if (!canOperate.value) {
        return
    }
    // 进入新一轮时显示全部卡片
    showAllCards()
    if (!intervalTimer.value) {
        randomBallData()
    }
    if (patternList.value.length) {
        for(let i=0;i<patternList.value.length;i++){
            if(i<rowCount.value*7){
                objects.value[patternList.value[i]-1].element.style.backgroundColor = rgba(cardColor.value, Math.random() * 0.5 + 0.25)
            }
        }
    }
    canOperate.value = false
    // 不再切换为球体形态
    await transform(targets.table, 600)
    currentStatus.value = 1
    // 移除球体旋转动画
}
// 开始抽奖
const startLottery = () => {
    if (!canOperate.value) {
        return
    }
    // 在开始前同步一次历史中奖标记，并确保已中奖与暂存中奖者被排除
    personConfig.syncIsWinFromHistory()
    // 验证是否已抽完全部奖项
    if (currentPrize.value.isUsed || !currentPrize.value) {
        toast.open({
            message: '抽奖抽完了',
            type: 'warning',
            position: 'top-right',
            duration: 10000
        })

        return
    }
    // 候选池：仅未中奖且不在暂存名单的人
    personPool.value = notPersonList.value
    luckyCount.value = 10
    // 自定义抽奖个数

    let leftover = currentPrize.value.count - currentPrize.value.isUsedCount
    const customCount = currentPrize.value.separateCount
    if (customCount && customCount.enable && customCount.countList.length > 0) {
        for (let i = 0; i < customCount.countList.length; i++) {
            if (customCount.countList[i].isUsedCount < customCount.countList[i].count) {
                leftover = customCount.countList[i].count - customCount.countList[i].isUsedCount
                break;
            }
        }
    }
    leftover < luckyCount.value ? luckyCount.value = leftover : luckyCount
    
    // 验证抽奖人数是否还够（在实际抽取数量确定后检查）
    if (personPool.value.length < luckyCount.value) {
        toast.open({
            message: '抽奖人数不够',
            type: 'warning',
            position: 'top-right',
            duration: 10000
        })

        return;
    }
    for (let i = 0; i < luckyCount.value; i++) {
        if (personPool.value.length > 0) {
            const randomIndex = Math.round(Math.random() * (personPool.value.length - 1))
            luckyTargets.value.push(personPool.value[randomIndex])
            personPool.value.splice(randomIndex, 1)
        }
    }
    currentStatus.value = 2
    // 启动红包雨
    startPacketRain()
    // 暂停卡片矩阵刷新，降低开销
    if (intervalTimer.value) {
        clearInterval(intervalTimer.value)
        intervalTimer.value = null
    }
    // 恢复礼花开关（仅在本轮结束时播放一次）
    enableConfetti = true
    // 移除球体旋转动画
}

const stopLottery = async () => {
    if (!canOperate.value) {
        return
    }
    clearInterval(intervalTimer.value)
    intervalTimer.value = null
    canOperate.value = false
    // 停止红包雨
    stopPacketRain()
    // 移除球体旋转动画

    const windowSize = { width: window.innerWidth, height: window.innerHeight }
    // 新增：中奖卡片为2时使用居中定位
    let customPositions: { x: number, y: number }[] = [];
    if (luckyTargets.value.length === 2) {
        const gap = 60; // 两卡片间距
        const centerX = 0; // threejs中这个点为0视为屏幕水平中心
        const y = 0; // 一般y保持不变
        customPositions = [
          { x: centerX - (cardSize.value.width * 1.2 + gap/2), y: y },
          { x: centerX + (cardSize.value.width * 1.2 + gap/2), y: y }
        ]
    }
    luckyTargets.value.forEach((person: IPersonConfig, index: number) => {
        let cardIndex = selectCard(luckyCardList.value, tableData.value.length, person.id)
        luckyCardList.value.push(cardIndex)
        let item = objects.value[cardIndex]
        let xTable, yTable;
        if(customPositions.length === 2) {
            xTable = customPositions[index].x;
            yTable = customPositions[index].y;
        } else {
            const pos = useElementPosition(item, rowCount.value, { width: cardSize.value.width * 2, height: cardSize.value.height * 2 }, windowSize, index);
            xTable = pos.xTable;
            yTable = pos.yTable;
        }
        new TWEEN.Tween(item.position)
            .to({
                x: xTable,
                y: yTable,
                z: 1000
            }, 1200)
            .easing(TWEEN.Easing.Exponential.InOut)
            .onStart(() => {
                item.element = useElementStyle(item.element, person, cardIndex, patternList.value, patternColor.value, luckyColor.value, { width: cardSize.value.width * 2, height: cardSize.value.height * 2 }, textSize.value * 2, 'lucky')
            })
            .start()
            .onComplete(() => {
                canOperate.value = true
                currentStatus.value = 3
            })
        new TWEEN.Tween(item.rotation)
            .to({
                x: 0,
                y: 0,
                z: 0
            }, 900)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start()
            .onComplete(() => {
                if (enableConfetti) {
                    confettiFire()
                    enableConfetti = false
                }
                resetCamera()
            })
    })
    // 中奖者确定后，仅显示中奖卡片
    hideBackgroundCards()
    // 将本轮产生的中奖者暂存到 store，用于下一轮开始前的前置排除
    personConfig.addProvisionalWinners(luckyTargets.value as any, currentPrize.value)
    // 结果已产生：立即暂存中奖名单，并同步奖品剩余/使用，确保“剩余 + 中奖 = 总数”
    try {
        const previewUsed = currentPrize.value.isUsedCount + luckyTargets.value.length
        // 在左侧奖品栏即时预览剩余：为当前奖项设置 previewUsedCount
        ;(currentPrize.value as any).previewUsedCount = previewUsed
        const payload = mapWinnersPayload(luckyTargets.value as any, currentPrize.value)
        await provisionalWinners(payload)
        await updatePrizeUsage({ prizeId: currentPrize.value.id as any, usedCount: previewUsed, total: currentPrize.value.count })
    } catch (e) {
        console.error('暂存中奖或更新进度失败', e)
    }
}
// 继续
const continueLottery = async () => {
    if (!canOperate.value) {
        return
    }
    // 恢复显示所有卡片
    showAllCards()

    const customCount = currentPrize.value.separateCount
    if (customCount && customCount.enable && customCount.countList.length > 0) {
        for (let i = 0; i < customCount.countList.length; i++) {
            if (customCount.countList[i].isUsedCount < customCount.countList[i].count) {
                customCount.countList[i].isUsedCount += luckyCount.value
                break;
            }
        }
    }
    currentPrize.value.isUsedCount += luckyCount.value
    luckyCount.value = 0
    if (currentPrize.value.isUsedCount >= currentPrize.value.count) {
        currentPrize.value.isUsed = true
        currentPrize.value.isUsedCount = currentPrize.value.count
    }
    personConfig.addAlreadyPersonList(luckyTargets.value, currentPrize.value)
    prizeConfig.updatePrizeConfig(currentPrize.value)
    // 本轮确认后，清空暂存名单
    personConfig.clearProvisionalWinners()
    // 确认后移除预览字段
    delete (currentPrize.value as any).previewUsedCount
    // 确认使用进度（以最终 usedCount 为准）
    try {
        await updatePrizeUsage({ prizeId: currentPrize.value.id as any, usedCount: currentPrize.value.isUsedCount, total: currentPrize.value.count })
    } catch (e) {
        console.error('确认更新进度失败', e)
    }
    // 动画将中奖卡片返回到背景表格
    await returnWinnersToTable()
    // 清空上一轮数据
    luckyTargets.value = []
    luckyCardList.value = []
    // 关闭弹窗
    if (prizeListRef.value && prizeListRef.value.closeDialog) {
        prizeListRef.value.closeDialog()
    }
    // 回到首页"开始"状态
    currentStatus.value = 0
    // 恢复矩阵随机刷新
    if (!intervalTimer.value) {
        randomBallData()
    }
}
const quitLottery = () => {
    // 回滚后台暂存数据与进度
    try {
        rollbackWinners(currentPrize.value.id as any)
        updatePrizeUsage({ prizeId: currentPrize.value.id as any, usedCount: currentPrize.value.isUsedCount, total: currentPrize.value.count })
    } catch (e) {
        console.error('回滚失败', e)
    }
    // 取消时也清空暂存名单
    personConfig.clearProvisionalWinners()
    // 取消时还原预览字段
    delete (currentPrize.value as any).previewUsedCount
    // 停止红包雨
    stopPacketRain()
    // 恢复显示所有卡片
    showAllCards()
    currentStatus.value = 0
    // 恢复矩阵随机刷新
    if (!intervalTimer.value) {
        randomBallData()
    }
}
// 庆祝动画
const confettiFire = () => {
    const duration = 3 * 1000;
    const end = Date.now() + duration;
    (function frame() {
        // launch a few confetti from the left edge
        confetti({
            particleCount: 2,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
        });
        // and launch a few from the right edge
        confetti({
            particleCount: 2,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
        });

        // keep going until we are out of time
        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
    centerFire(0.25, {
        spread: 26,
        startVelocity: 55,
    });
    centerFire(0.2, {
        spread: 60,
    });
    centerFire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8
    });
    centerFire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2
    });
    centerFire(0.1, {
        spread: 120,
        startVelocity: 45,
    });
}
const centerFire = (particleRatio: number, opts: any) => {
    const count = 200
    confetti({
        origin: { y: 0.7 },
        ...opts,
        particleCount: Math.floor(count * particleRatio)
    });
}

const setDefaultPersonList = () => {
    personConfig.setDefaultPersonList()
    // 刷新页面
    window.location.reload()
}
// 随机单张闪烁刷新（每2秒刷新20张）：当人数多于可显示数量时按顺序轮换；不足时随机重复
let displayOffset = 0
const randomBallData = (mod: 'default' | 'lucky' | 'sphere' = 'default') => {
    // 2 秒一次，随机挑一张卡片刷新
    intervalTimer.value = setInterval(() => {
        // 仅在首页或准备态刷新，抽奖中/结果态不刷新
        if (!(currentStatus.value === 0 || currentStatus.value === 1)) return
        const capacity = Math.min(tableData.value.length, objects.value.length)
        const pool = notPersonList.value
        if (capacity <= 0 || !pool || pool.length <= 0) return

        const batchSize = Math.min(20, capacity)
        const chosenSlots = new Set<number>()
        while (chosenSlots.size < batchSize) {
            chosenSlots.add(Math.floor(Math.random() * capacity))
        }
        chosenSlots.forEach((slotIndex) => {
            let person: any
            if (pool.length >= capacity) {
                person = pool[displayOffset % pool.length]
                displayOffset = (displayOffset + 1) % pool.length
            } else {
                person = pool[Math.floor(Math.random() * pool.length)]
            }
            const obj = objects.value[slotIndex]
            if (!obj) return
            obj.element = useElementStyle(
                obj.element,
                person,
                slotIndex,
                patternList.value,
                patternColor.value,
                cardColor.value,
                { width: cardSize.value.width, height: cardSize.value.height },
                textSize.value,
                mod
            )
            // 闪烁效果
            try {
                obj.element.classList.add('flash')
                setTimeout(() => obj.element.classList.remove('flash'), 300)
            } catch (e) {}
        })
    }, 1000)
}
// 监听键盘
const listenKeyboard = () => {
    window.addEventListener('keydown', (e: any) => {
        if ((e.keyCode !== 32 || e.keyCode !== 27) && !canOperate.value) {
            return
        }
        if (e.keyCode === 27 && currentStatus.value === 3) {
            quitLottery()
        }
        if (e.keyCode !== 32) {
            return
        }
        switch (currentStatus.value) {
            case 0:
                startLottery()
                break;
            case 1:
                startLottery()
                break;
            case 2:
                stopLottery()
                break;
            case 3:
                continueLottery()
                break;
            default:
                break;
        }
    })
}
onMounted(() => {
    initTableData();
    init();
    animation();
    containerRef.value!.style.color = `${textColor}`
    randomBallData()
    listenKeyboard()
    // 进入首页时强制隐藏左侧奖品栏
    globalConfig.setIsShowPrizeList(false)
    // 红包雨可见性处理
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopPacketRain()
        }
    })
});
onUnmounted(() => {
    clearInterval(intervalTimer.value)
    intervalTimer.value = null
    window.removeEventListener('keydown', listenKeyboard)
    stopPacketRain()
})
// watch(() => currentPrize.value.isUsed, (val) => {
//     if (val) {
//         currentPrize.value = JSON.parse(JSON.stringify(currentPrize.value))
//     }
// })
</script>

<template>
    <div class="absolute z-10 flex flex-col items-center justify-center -translate-x-1/2 left-1/2">
        <h2 class="pt-12 m-0 mb-12 font-mono tracking-wide text-center leading-12 header-title"
            :style="{ fontSize: textSize * 1.5 + 'px', color: textColor }">{{ topTitle }}</h2>
        <div class="flex gap-3">
            <button v-if="tableData.length <= 0" class="cursor-pointer btn btn-outline btn-secondary btn-lg"
                @click="router.push('config')">暂无人员信息，前往导入</button>
            <button v-if="tableData.length <= 0" class="cursor-pointer btn btn-outline btn-secondary btn-lg"
                @click="setDefaultPersonList">使用默认数据</button>
        </div>
    </div>
    <div class="background-container">
        <div id="container" ref="containerRef" class="3dContainer">

            <!-- 选中菜单结构 start-->
            <div id="menu">
                <div class="start" v-if="(currentStatus == 0 || currentStatus == 1) && tableData.length > 0">
                    <button class="btn-start" @click="startLottery"><strong>开始</strong>
                        <div id="container-stars">
                            <div id="stars"></div>
                        </div>

                        <div id="glow">
                            <div class="circle"></div>
                            <div class="circle"></div>
                        </div>
                    </button>
                </div>

                <button class="btn-end btn glass btn-lg" @click="stopLottery" v-if="currentStatus == 2">抽取幸运儿</button>

                <div v-if="currentStatus == 3" class="flex justify-center gap-6 enStop">
                    <div class="start">
                        <button class="btn-start" @click="continueLottery"><strong>继续！</strong>
                            <div id="container-stars">
                                <div id="stars"></div>
                            </div>

                            <div id="glow">
                                <div class="circle"></div>
                                <div class="circle"></div>
                            </div>
                        </button>
                    </div>

                    <div class="start">
                        <button class="btn-cancel" @click="quitLottery"><strong>取消</strong>
                            <div id="container-stars">
                                <div id="stars"></div>
                            </div>

                            <div id="glow">
                                <div class="circle"></div>
                                <div class="circle"></div>
                            </div>
                        </button>
                    </div>
                </div>
                <!--   <button id="table" @click="transform(targets.table, 2000)">TABLE</button> -->
                <!--  <button id="helix" @click="transform(targets.helix, 2000)">HELIX</button> -->

            </div>
            <!-- end -->
            <!-- 红包雨画布覆盖层 -->
            <canvas ref="packetCanvasRef" class="packet-canvas"></canvas>
        </div>
        <StarsBackground></StarsBackground>

        <!-- <LuckyView :luckyPersonList="luckyTargets"  ref="LuckyViewRef"></LuckyView> -->
        <!-- <PlayMusic class="absolute right-0 bottom-1/2"></PlayMusic> -->
        <PrizeList ref="prizeListRef" class="absolute left-0 top-32"></PrizeList>
        
        <!-- 右上角显示当前奖项信息 -->
        <div v-if="(currentStatus === 2 || currentStatus === 3) && currentPrize" 
             class="absolute top-4 right-4 z-50 prize-info-panel">
            <div class="flex items-center gap-2 px-3 py-2.5 bg-gray-800/85 backdrop-blur-sm rounded-lg shadow-lg border border-gray-600/40">
                <div class="flex items-center justify-center w-5 h-5 text-white text-xs font-bold rounded-full bg-gray-700/60">
                    i
                </div>
                <span class="text-white text-sm font-medium whitespace-nowrap">
                    现在抽取{{ currentPrize.name }} {{ currentStatus === 3 ? luckyTargets.length : luckyCount }}人
                </span>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">

.background-container {
  background-image:  url('/images/background1.png'); /* 使用绑定的变量 */
  background-size: cover;
  background-position: center;
  height: 100vh;
}

.packet-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

#menu {
    position: absolute;
    z-index: 100;
    width: 100%;
    bottom: 50px;
    text-align: center;
    margin: 0 auto;
    font-size: 32px;
}

.header-title {
    -webkit-animation: tracking-in-expand-fwd 0.8s cubic-bezier(0.215, 0.610, 0.355, 1.000) both;
    animation: tracking-in-expand-fwd 0.8s cubic-bezier(0.215, 0.610, 0.355, 1.000) both;
}

.start {
    // 居中
    display: flex;
    justify-content: center;
}

.btn-start {
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 13rem;
    overflow: hidden;
    height: 3rem;
    background-size: 300% 300%;
    backdrop-filter: blur(1rem);
    border-radius: 5rem;
    transition: 0.5s;
    animation: gradient_301 5s ease infinite;
    border: double 4px transparent;
    background-image: linear-gradient(#212121, #212121), linear-gradient(137.48deg, #ffdb3b 10%, #FE53BB 45%, #8F51EA 67%, #0044ff 87%);
    background-origin: border-box;
    background-clip: content-box, border-box;
    -webkit-animation: pulsate-fwd 1.2s ease-in-out infinite both;
    animation: pulsate-fwd 1.2s ease-in-out infinite both;
}

.btn-cancel {
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 13rem;
    overflow: hidden;
    height: 3rem;
    background-size: 300% 300%;
    backdrop-filter: blur(1rem);
    border-radius: 5rem;
    transition: 0.5s;
    animation: gradient_301 5s ease infinite;
    border: double 4px transparent;
    background-image: linear-gradient(#212121, #212121), linear-gradient(137.48deg, #ffdb3b 10%, #FE53BB 45%, #8F51EA 67%, #0044ff 87%);
    background-origin: border-box;
    background-clip: content-box, border-box;
}

#container-stars {
    position: absolute;
    z-index: -1;
    width: 100%;
    height: 100%;
    overflow: hidden;
    transition: 0.5s;
    backdrop-filter: blur(1rem);
    border-radius: 5rem;
}

strong {
    z-index: 2;
    font-family: 'Avalors Personal Use';
    font-size: 12px;
    letter-spacing: 5px;
    color: #FFFFFF;
    text-shadow: 0 0 4px white;
}

#glow {
    position: absolute;
    display: flex;
    width: 12rem;
}

.circle {
    width: 100%;
    height: 30px;
    filter: blur(2rem);
    animation: pulse_3011 4s infinite;
    z-index: -1;
}

.circle:nth-of-type(1) {
    background: rgba(254, 83, 186, 0.636);
}

.circle:nth-of-type(2) {
    background: rgba(142, 81, 234, 0.704);
}

.btn-start:hover #container-stars {
    z-index: 1;
    background-color: #212121;
}

.btn-start:hover {
    transform: scale(1.1)
}

.btn-start:active {
    border: double 4px #FE53BB;
    background-origin: border-box;
    background-clip: content-box, border-box;
    animation: none;
}

.btn-start:active .circle {
    background: #FE53BB;
}

#stars {
    position: relative;
    background: transparent;
    width: 200rem;
    height: 200rem;
}

#stars::after {
    content: "";
    position: absolute;
    top: -10rem;
    left: -100rem;
    width: 100%;
    height: 100%;
    animation: animStarRotate 90s linear infinite;
}

#stars::after {
    background-image: radial-gradient(#ffffff 1px, transparent 1%);
    background-size: 50px 50px;
}

#stars::before {
    content: "";
    position: absolute;
    top: 0;
    left: -50%;
    width: 170%;
    height: 500%;
    animation: animStar 60s linear infinite;
}

#stars::before {
    background-image: radial-gradient(#ffffff 1px, transparent 1%);
    background-size: 50px 50px;
    opacity: 0.5;
}

@keyframes animStar {
    from {
        transform: translateY(0);
    }

    to {
        transform: translateY(-135rem);
    }
}

@keyframes animStarRotate {
    from {
        transform: rotate(360deg);
    }

    to {
        transform: rotate(0);
    }
}

@keyframes gradient_301 {
    0% {
        background-position: 0% 50%;
    }

    50% {
        background-position: 100% 50%;
    }

    100% {
        background-position: 0% 50%;
    }
}

@keyframes pulse_3011 {
    0% {
        transform: scale(0.75);
        box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.7);
    }

    70% {
        transform: scale(1);
        box-shadow: 0 0 0 10px rgba(0, 0, 0, 0);
    }

    100% {
        transform: scale(0.75);
        box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
    }
}

.btn-end {
    -webkit-animation: pulsate-fwd 0.9s ease-in-out infinite both;
    animation: pulsate-fwd 0.9s ease-in-out infinite both;
    cursor: pointer;
}

.btn-end {
    --glow-color: rgb(217, 176, 255);
    --glow-spread-color: rgba(191, 123, 255, 0.781);
    --enhanced-glow-color: rgb(231, 206, 255);
    --btn-color: rgb(100, 61, 136);
    border: .25em solid var(--glow-color);
    padding: 1em 3em;
    color: var(--glow-color);
    font-size: 15px;
    font-weight: bold;
    background-color: var(--btn-color);
    border-radius: 1em;
    outline: none;
    box-shadow: 0 0 1em .25em var(--glow-color),
        0 0 4em 1em var(--glow-spread-color),
        inset 0 0 .75em .25em var(--glow-color);
    text-shadow: 0 0 .5em var(--glow-color);
    position: relative;
    transition: all 0.3s;
    -webkit-animation: swing-in-top-fwd 0.5s cubic-bezier(0.175, 0.885, 0.320, 1.275) both;
    animation: swing-in-top-fwd 0.5s cubic-bezier(0.175, 0.885, 0.320, 1.275) both;
}

.btn-end::after {
    pointer-events: none;
    content: "";
    position: absolute;
    top: 120%;
    left: 0;
    height: 100%;
    width: 100%;
    background-color: var(--glow-spread-color);
    filter: blur(2em);
    opacity: .7;
    transform: perspective(1.5em) rotateX(35deg) scale(1, .6);
}

.btn-end:hover {
    color: var(--btn-color);
    background-color: var(--glow-color);
    box-shadow: 0 0 1em .25em var(--glow-color),
        0 0 4em 2em var(--glow-spread-color),
        inset 0 0 .75em .25em var(--glow-color);
}

.btn-end:active {
    box-shadow: 0 0 0.6em .25em var(--glow-color),
        0 0 2.5em 2em var(--glow-spread-color),
        inset 0 0 .5em .25em var(--glow-color);
}

// 单张闪烁效果（刷新时轻微亮度变化）
.flash {
    animation: card-flash 0.3s ease-in-out;
}
@keyframes card-flash {
    0% { filter: brightness(1); }
    50% { filter: brightness(1.35); }
    100% { filter: brightness(1); }
}

// 按钮动画
@-webkit-keyframes pulsate-fwd {
    0% {
        -webkit-transform: scale(1);
        transform: scale(1);
    }

    50% {
        -webkit-transform: scale(1.1);
        transform: scale(1.1);
    }

    100% {
        -webkit-transform: scale(1);
        transform: scale(1);
    }
}

@keyframes pulsate-fwd {
    0% {
        -webkit-transform: scale(1);
        transform: scale(1);
    }

    50% {
        -webkit-transform: scale(1.2);
        transform: scale(1.2);
    }

    100% {
        -webkit-transform: scale(1);
        transform: scale(1);
    }
}

@-webkit-keyframes tracking-in-expand-fwd {
    0% {
        letter-spacing: -0.5em;
        -webkit-transform: translateZ(-700px);
        transform: translateZ(-700px);
        opacity: 0;
    }

    40% {
        opacity: 0.6;
    }

    100% {
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
        opacity: 1;
    }
}

@keyframes tracking-in-expand-fwd {
    0% {
        letter-spacing: -0.5em;
        -webkit-transform: translateZ(-700px);
        transform: translateZ(-700px);
        opacity: 0;
    }

    40% {
        opacity: 0.6;
    }

    100% {
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
        opacity: 1;
    }
}
</style>
