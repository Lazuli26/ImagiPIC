import { en } from "./Lang-EN";
import { es } from "./Lang-ES";

export interface LanguageType {
    /**Code of the current language*/
    //code: string,
    page: {
        /**Title on tab*/
        title: string,
        /**Tooltip on tab*/
        tooltip: string
    }
    menu: {
        /**Placeholder of the Nickname TextField*/
        nickname_placeholder: string,
        /**Title of the Nickname Textfield*/
        nickname_title: string,
        /**Play Button text*/
        play_btn: string,
        /**Title in-page*/
        title: string
    },
    game: {
        /**Title of the message that shows up when the player enters on judge mode*/
        judge_comment_title: string,
        /**Description of the message that shows up when the player enters on judge mode*/
        judge_comment_description: string,
        /**Text of the persistent instructional comment */
        judge_helper_decide: string,
        /**Title of the message that shows up when the player enters on guess mode */
        guess_comment_title: string,
        /**Description of the message that shows up when the player enters on guess mode */
        guess_comment_description: string,
        /**The text of the guess button*/
        guess_btn: string,
        /**The placeholder of the guess TextField */
        guess_txt_placeholder: string,
        /**The title of the guess TextField */
        guess_txt_title: string
    }
}

export const langs = {
    es: es,
    en: en
}
