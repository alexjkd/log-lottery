import { defineStore } from 'pinia';
import { IPersonConfig } from '@/types/storeType';
import { IPrizeConfig } from '@/types/storeType';
import { defaultPersonList } from './data'
import { usePrizeConfig } from './prizeConfig';
import dayjs from 'dayjs'
export const usePersonConfig = defineStore('person', {
    state() {
        return {
            personConfig: {
                allPersonList: [] as IPersonConfig[],
                alreadyPersonList: [] as IPersonConfig[],
                provisionalWinnerIds: [] as number[],
                provisionalWinnerList: [] as IPersonConfig[],
            }
        };
    },
    getters: {
        // 获取全部配置
        getPersonConfig(state) {
            return state.personConfig;
        },
        // 获取全部人员名单
        getAllPersonList(state) {
            return state.personConfig.allPersonList.filter((item: IPersonConfig) => {
                return item
            });
        },
        // 获取未获此奖的人员名单
        getNotThisPrizePersonList(state: any) {
            const currentPrize = usePrizeConfig().prizeConfig.currentPrize;
            const data = state.personConfig.allPersonList.filter((item: IPersonConfig) => {
                return !item.prizeId.includes(currentPrize.id as string);
            });

            return data
        },
        // 获取已中奖人员名单（包含暂存结果，用于页面即时预览）
        getAlreadyPersonList(state) {
            const confirmed = state.personConfig.allPersonList.filter((item: IPersonConfig) => item.isWin === true)
            const preview = state.personConfig.provisionalWinnerList
            const map: Record<number, IPersonConfig> = {}
            confirmed.forEach(p => { map[p.id] = p })
            preview.forEach(p => { if (!map[p.id]) map[p.id] = p })
            return Object.values(map)
        },
        // 获取中奖人员详情
        getAlreadyPersonDetail(state) {
            const confirmed = state.personConfig.alreadyPersonList
            const preview = state.personConfig.provisionalWinnerList
            const map: Record<number, IPersonConfig> = {}
            confirmed.forEach(p => { map[p.id] = p })
            preview.forEach(p => { if (!map[p.id]) map[p.id] = p })
            return Object.values(map)
        },
        // 获取未中奖人员名单
        getNotPersonList(state) {
            return state.personConfig.allPersonList.filter((item: IPersonConfig) => {
                const isProvisional = state.personConfig.provisionalWinnerIds.includes(item.id)
                return item.isWin === false && !isProvisional;
            });
        },
    },
    actions: {
        // 在抽奖开始前调用：根据历史中奖记录同步 isWin，避免旧数据未标记导致的重复抽取
        syncIsWinFromHistory() {
            this.personConfig.allPersonList = this.personConfig.allPersonList.map((item: IPersonConfig) => {
                if (Array.isArray(item.prizeId) && item.prizeId.length > 0) {
                    item.isWin = true
                }
                return item
            })
        },
        // 暂存本轮中奖人员（用于下一轮前置排除）
        addProvisionalWinners(personList: IPersonConfig[], prize?: IPrizeConfig) {
            personList.forEach((p) => {
                if (!this.personConfig.provisionalWinnerIds.includes(p.id)) {
                    this.personConfig.provisionalWinnerIds.push(p.id)
                }
                if (!this.personConfig.provisionalWinnerList.find(item => item.id === p.id)) {
                    const copy: IPersonConfig = JSON.parse(JSON.stringify(p))
                    // 仅用于展示
                    copy.isWin = true
                    if (prize) {
                        copy.prizeName = [prize.name]
                        copy.prizeTime = [dayjs(new Date()).format('YYYY-MM-DD HH:mm:ss')]
                        copy.prizeId = [String(prize.id)] as any
                    }
                    this.personConfig.provisionalWinnerList.push(copy)
                }
            })
        },
        // 清空暂存的中奖人员
        clearProvisionalWinners() {
            this.personConfig.provisionalWinnerIds = []
            this.personConfig.provisionalWinnerList = []
        },
        // 添加未中奖人员
        addNotPersonList(personList: IPersonConfig[]) {
            if (personList.length <= 0) {
                return
            }
            personList.forEach((item: IPersonConfig) => {
                this.personConfig.allPersonList.push(item);
            });
        },
        // 添加已中奖人员
        addAlreadyPersonList(personList: IPersonConfig[], prize: IPrizeConfig | null) {
            if (personList.length <= 0) {
                return
            }
            personList.forEach((person: IPersonConfig) => {
                this.personConfig.allPersonList.map((item: IPersonConfig) => {
                    if (item.id === person.id && prize != null) {
                        // 全局唯一中奖：若已中奖则不重复计入
                        if (item.isWin === true) {
                            return item
                        }
                        item.isWin = true
                        item.prizeName.push(prize.name)
                        item.prizeTime.push(dayjs(new Date()).format('YYYY-MM-DD HH:mm:ss'))
                        item.prizeId.push(prize.id as string)
                    }

                    return item
                });
                // 若该人此前未中奖，则加入已中奖明细
                if (!this.personConfig.alreadyPersonList.find((p) => p.id === person.id)) {
                    this.personConfig.alreadyPersonList.push(person);
                }
            });
        },
        // 从已中奖移动到未中奖
        moveAlreadyToNot(person: IPersonConfig) {
            if (person.id == undefined || person.id == null) {
                return
            }
            const alreadyPersonListLength = this.personConfig.alreadyPersonList.length
            // 回滚奖项使用计数（根据该人的 prizeId 列表逐一减一）
            try {
                const prizeStore = usePrizeConfig()
                if (Array.isArray(person.prizeId)) {
                    person.prizeId.forEach((pid: any) => {
                        const prize = prizeStore.prizeConfig.prizeList.find((p: any) => String(p.id) === String(pid))
                        if (prize) {
                            prize.isUsedCount = Math.max(0, (prize.isUsedCount || 0) - 1)
                            // 若有预览字段也要同步（通常管理页不会存在，但做保护）
                            if ((prize as any).previewUsedCount != null) {
                                ;(prize as any).previewUsedCount = Math.max(0, (prize as any).previewUsedCount - 1)
                            }
                        }
                    })
                }
            } catch (e) {
                // 忽略异常，确保不影响前端交互
            }
            for (let i = 0; i < this.personConfig.allPersonList.length; i++) {
                if (person.id === this.personConfig.allPersonList[i].id) {
                    this.personConfig.allPersonList[i].isWin = false
                    this.personConfig.allPersonList[i].prizeName = []
                    this.personConfig.allPersonList[i].prizeTime = []
                    this.personConfig.allPersonList[i].prizeId = []

                    break
                }
            }
            for (let i = 0; i < alreadyPersonListLength; i++) {
                this.personConfig.alreadyPersonList = this.personConfig.alreadyPersonList.filter((item: IPersonConfig) =>
                    item.id !== person.id
                )
            }
            // 同步移除预览集合，避免列表继续展示
            this.personConfig.provisionalWinnerIds = this.personConfig.provisionalWinnerIds.filter(id => id !== person.id)
            this.personConfig.provisionalWinnerList = this.personConfig.provisionalWinnerList.filter(item => item.id !== person.id)
        },
        // 删除指定人员
        deletePerson(person: IPersonConfig) {
            if (person.id != undefined || person.id != null) {
                this.personConfig.allPersonList = this.personConfig.allPersonList.filter((item: IPersonConfig) => item.id !== person.id);
                this.personConfig.alreadyPersonList = this.personConfig.alreadyPersonList.filter((item: IPersonConfig) => item.id !== person.id);
            }
        },
        // 删除所有人员
        deleteAllPerson() {
            this.personConfig.allPersonList = [];
            this.personConfig.alreadyPersonList = [];
            this.personConfig.provisionalWinnerIds = []
            this.personConfig.provisionalWinnerList = []
        },

        // 删除所有人员
        resetPerson() {
            this.personConfig.allPersonList = [];
            this.personConfig.alreadyPersonList = [];
            this.personConfig.provisionalWinnerIds = []
            this.personConfig.provisionalWinnerList = []
        },
        // 重置已中奖人员
        resetAlreadyPerson() {
            // 把已中奖人员合并到未中奖人员，要验证是否已存在
            this.personConfig.allPersonList.forEach((item: IPersonConfig) => {
                item.isWin = false;
                item.prizeName = [];
                item.prizeTime = [];
                item.prizeId = []
            });
            this.personConfig.alreadyPersonList = [];
            this.personConfig.provisionalWinnerIds = []
            this.personConfig.provisionalWinnerList = []
        },
        setDefaultPersonList() {
            this.personConfig.allPersonList = defaultPersonList;
            this.personConfig.alreadyPersonList = [];
            this.personConfig.provisionalWinnerIds = []
            this.personConfig.provisionalWinnerList = []
        },
        // 重置所有配置
        reset() {
            this.personConfig = {
                allPersonList: [] as IPersonConfig[],
                alreadyPersonList: [] as IPersonConfig[],
                provisionalWinnerIds: [] as number[],
                provisionalWinnerList: [] as IPersonConfig[],
            }
        },
    },
    persist: {
        enabled: true,
        strategies: [
            {
                // 如果要存储在localStorage中
                storage: localStorage,
                key: 'personConfig',
            },
        ],
    },
});
