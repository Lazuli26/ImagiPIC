import { combineReducers } from 'redux';
import { LangState, Language } from './language'

export interface CombinedState {
    Language: LangState
}
export default combineReducers({ Language })