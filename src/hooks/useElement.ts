import { rgba } from '@/utils/color'
import { IPersonConfig } from '@/types/storeType'

export const useElementStyle = (
    element: any, 
    person: IPersonConfig, 
    index: number, 
    patternList: number[], 
    patternColor: string, 
    cardColor: string, 
    cardSize: { width: number, height: number }, 
    textSize: number, 
    mod: 'default' | 'lucky' | 'sphere' = 'default'
) => {
    // 设置背景色
    if (patternList.includes(index + 1) && mod === 'default') {
        element.style.backgroundColor = rgba(patternColor, Math.random() * 0.2 + 0.8);
    } else if (mod === 'sphere' || mod === 'default') {
        element.style.backgroundColor = rgba(cardColor, Math.random() * 0.5 + 0.25);
    } else if (mod === 'lucky') {
        element.style.backgroundColor = rgba(cardColor, 1);
    }

    // 基本样式：居中对齐，边框和阴影
    element.style.border = `1px solid ${rgba(cardColor, 0.25)}`;
    element.style.boxShadow = `0 0 12px ${rgba(cardColor, 0.5)}`;
    element.style.width = `${cardSize.width}px`;
    element.style.height = `${cardSize.height}px`;
    element.className = mod === 'lucky' ? 'lucky-element-card' : 'element-card';

    // 使用 Flexbox 实现整体内容居中
    element.style.display = 'flex';
    element.style.flexDirection = 'column';
    element.style.justifyContent = 'center';
    element.style.alignItems = 'center';
    element.style.textAlign = 'center'; // 保证文本居中

    // 子元素样式设置
    if (element.children.length >= 3) {
        // 第一个子元素：UID
        element.children[0].style.cssText = `
            font-size: ${textSize * 0.5}px;
            line-height: 1.5;
            text-align: center;
            left:0;
            right:0
        `;
        if (person.uid) element.children[0].textContent = person.uid;

        // 第二个子元素：Name
        element.children[1].style.cssText = `
            font-size: ${textSize}px;
            line-height: ${textSize * 3}px;
            text-shadow: 0 0 12px ${rgba(cardColor, 0.95)};
            text-align: center;
        `;
        if (person.name) element.children[1].textContent = person.name;

        // 第三个子元素：Department & Identity
        element.children[2].style.cssText = `
            font-size: ${textSize * 0.5}px;
            line-height: 1.5;
            text-align: center;
        `;
        if (person.department || person.identity) {
            element.children[2].innerHTML = `${person.department || ''}<br/>${person.identity || ''}`;
        }
    }

    // 鼠标事件：交互时高亮边框和阴影
    element.addEventListener('mouseenter', (ev: MouseEvent) => {
        const target = ev.target as HTMLElement;
        target.style.border = `1px solid ${rgba(cardColor, 0.75)}`;
        target.style.boxShadow = `0 0 12px ${rgba(cardColor, 0.75)}`;
    });

    element.addEventListener('mouseleave', (ev: MouseEvent) => {
        const target = ev.target as HTMLElement;
        target.style.border = `1px solid ${rgba(cardColor, 0.25)}`;
        target.style.boxShadow = `0 0 12px ${rgba(cardColor, 0.5)}`;
    });

    return element;
};


// export const useElementPosition=(element:any,count:number,cardSize:{width:number,height:number},windowSize:{width:number,height:number},cardIndex:number)=>{
//     const centerPosition={
//         x:0,
//         y:windowSize.height/2-cardSize.height/2
//     }
//   const index =cardIndex%5
//     if(index==0){
//         element.position.x=centerPosition.x
//         element.position.y=centerPosition.y-Math.floor(cardIndex/5)*(cardSize.height+60)
//     }
//     else{
//         element.position.x=index%2===0?Math.ceil(index/2)*(cardSize.width+100):-Math.ceil(index/2)*(cardSize.width+100)
//         element.position.y=centerPosition.y-Math.floor(cardIndex/5)*(cardSize.height+60)
//     }

//     return element
// }

export const useElementPosition = (element: any, count: number, cardSize: { width: number, height: number }, windowSize: { width: number, height: number }, cardIndex: number) => {
    let xTable = 0
    let yTable = 0
    const centerPosition = {
        x: 0,
        y: windowSize.height / 2 - cardSize.height / 2
    }
    const index = cardIndex % 5
    if (index == 0) {
        xTable = centerPosition.x
        yTable = centerPosition.y - Math.floor(cardIndex / 5) * (cardSize.height + 60)
    }
    else {
        xTable = index % 2 === 0 ? Math.ceil(index / 2) * (cardSize.width + 100) : -Math.ceil(index / 2) * (cardSize.width + 100)
        yTable = centerPosition.y - Math.floor(cardIndex / 5) * (cardSize.height + 60)
    }

    return { xTable, yTable }
}
