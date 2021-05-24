import _ from 'lodash'
import React, { FC, useEffect, useState } from 'react'
import './index.scss';
/*
const geometrizeViewStyle = {
    landscape: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "75vh",
        width: "50vw"
    },
    portrait: {
        display: "flex",
        justifyContent: "center",
        padding: "7.5vw 0",
        height: "50vh",
        maxHeight: "50vh",
        maxWidth: "100vw"
    }
}
*/
interface svgConfig {
    viewBox: {
        width: number,
        height: number
    },
    svg: {
        width: number,
        height: number
    }
}
const scaleToWindow = (minSize: number, maxSize: number): [number, number] => {
    maxSize = maxSize / minSize
    minSize = _.max([window.innerWidth, window.innerHeight]) ?? minSize
    maxSize = maxSize * minSize;

    return [minSize, maxSize]
}
const SvgRenderer: FC<{ shapes: string[], width: number, height: number }> = ({ shapes, width, height }) => {
    //const windowLandscape = window.innerWidth >= window.innerHeight;
    //const imgLandscape = width >= height;
    const [svgConfig, setViewBoxSize] = useState<svgConfig | null>(null)
    useEffect(() => {
        const [svgWidth, svgHeight] = width < height ?
            scaleToWindow(width, height) :
            scaleToWindow(height, width).reverse()
        setViewBoxSize({
            svg: {
                width: svgWidth,
                height: svgHeight
            },
            viewBox: {
                width: width,
                height: height
            }
        })
    }, [width, height])
    return svgConfig ? <div
        className="svgViewPort"
        children={
            <div className="svgElement" children={<>
                <svg width={svgConfig.svg.width} height={svgConfig.svg.height} viewBox={`0 0 ${svgConfig.viewBox.width} ${svgConfig.viewBox.height}`} dangerouslySetInnerHTML={{ __html: shapes.join('\n') }} />                
            </>} />
        } />
        : <></>
}

export default SvgRenderer