import React from 'react'
import styled from 'styled-components'
import Pointer from './pointer'
import { touchable } from '../modules/mutators'

/******************************************************************************/
// Sub Components
/******************************************************************************/

const TimelineStyle = styled.div.attrs({ })`
  height: 1em;
  position: fixed;
  width: 100%;
  bottom: 0;
  border-bottom: 4px solid #c96af2;

  svg {
    position: relative;
    bottom: -4px;
  }
`::touchable()

const TimelinePointer = styled(Pointer).attrs({
  style: props => Object({ left: `calc(${props.currentTime}% - 12px)` })
})`
  cursor: 'col-resize';
  fill: ${props => props.theme.fg};
`

/******************************************************************************/
// Main Component
/******************************************************************************/

class Timeline extends React.Component {

  startCurrentTime = 0

  onPanStart = () => {
    this.startCurrentTime = this.props.currentTime
  }

  onPan = ({ currentX }) => {
    const { setCurrentTime } = this.props

    if (this.startMaxTime === Infinity)
      return

    const deltaFactor = currentX / innerWidth
    const newCurrentTime = this.startCurrentTime + (deltaFactor * 100)

    setCurrentTime(newCurrentTime)
  }

  render () {

    const { children, currentTime, ...props } = this.props
    const { onPan, onPanStart } = this

    delete props.setCurrentTime
    delete props.setSpeed

    return <TimelineStyle onPanStart={onPanStart} onPan={onPan} {...props} >
      { children }
      <TimelinePointer currentTime={currentTime}/>
    </TimelineStyle>
  }
}

/******************************************************************************/
// Exports
/******************************************************************************/

export default Timeline