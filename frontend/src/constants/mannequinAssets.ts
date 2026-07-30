import type { MannequinSkin, MannequinView } from "../types/collection";

import mannequinBlueBack from "../assets/collections/mannequin-blue-back.png";

import mannequinBlueFront from "../assets/collections/mannequin-blue-front.png";

import mannequinPinkBack from "../assets/collections/mannequin-pink-back.png";

import mannequinPinkFront from "../assets/collections/mannequin-pink-front.png";

import mannequinWhiteBack from "../assets/collections/mannequin-white-back.png";

import mannequinWhiteFront from "../assets/collections/mannequin-white-front.png";

import mannequinPartsBack from "../assets/collections/mannequin-parts-back.png";

import mannequinPartsFront from "../assets/collections/mannequin-parts-front.png";



export const MANNEQUIN_ASSETS: Record<

	MannequinSkin,

	Record<MannequinView, string>

> = {

	white: { front: mannequinWhiteFront, back: mannequinWhiteBack },

	blue: { front: mannequinBlueFront, back: mannequinBlueBack },

	pink: { front: mannequinPinkFront, back: mannequinPinkBack },

};



export const MANNEQUIN_PART_MASKS: Record<MannequinView, string> = {

	front: mannequinPartsFront,

	back: mannequinPartsBack,

};



export const MANNEQUIN_SKIN_OPTIONS: {

	id: MannequinSkin;

	label: string;

	swatchClass: string;

}[] = [

	{ id: "white", label: "흰색", swatchClass: "bg-white border border-black/15" },

	{ id: "blue", label: "하늘색", swatchClass: "bg-[#E4EDFB] border border-black/10" },

	{ id: "pink", label: "분홍색", swatchClass: "bg-[#FBE6EA] border border-black/10" },

];

