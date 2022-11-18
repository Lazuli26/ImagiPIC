import { IonRange, IonProgressBar } from "@ionic/react";
import _ from "lodash";
import React, { CSSProperties, useState } from "react"

import './PlayerBar.css';
type PlayerBarProps = {
    Playing: boolean,
    TogglePause: () => Promise<boolean>;
    MoveCursor: (position: number) => any;
    totalFrames: number;
    cursorPosition: number;
    bufferSize: number;
}

const progresBarStyle: CSSProperties = {
    gridArea: "1 / 1 / 12 / 12"
}
const rangeBarStyle: CSSProperties = {
    height: 0, padding: 0,
    gridArea: "1 / 1 / 12 / 12"
}
const divStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "250px 1fr",
    gridTemplateRows: "150px 1fr",
    width: "100%"
}
export const PlayerBar: React.FC<PlayerBarProps> = ({ TogglePause, MoveCursor, totalFrames, cursorPosition, bufferSize }) => {
    const [innerValue, setInnerValue] = useState<number>(cursorPosition)
    const [isDragging, setIsDragging] = useState(false);

    const cursorValue = isDragging ? innerValue : cursorPosition
    return <div style={divStyle}>

        <IonRange
            onIonChange={({ detail }) => {
                if (isDragging)
                    setInnerValue(_.isObject(detail.value) ? 0 : detail.value)
            }}
            onIonKnobMoveStart={({ detail }) => {
                setInnerValue(_.isObject(detail.value) ? 0 : detail.value)
                setIsDragging(true)
            }}
            onIonKnobMoveEnd={({ detail }) => {
                const pos = _.isObject(detail.value) ? 0 : detail.value
                setInnerValue(pos)
                MoveCursor(pos)
                setIsDragging(false)
            }}
            style={rangeBarStyle}
            min={0}
            max={totalFrames}
            value={cursorValue}
        />
        <IonProgressBar style={progresBarStyle} value={bufferSize / totalFrames}
        //value={PlayerInfo.shapes_shown/PlayerInfo.shapes_cap}
        />
    </div>
}