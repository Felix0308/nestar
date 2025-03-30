import { ObjectId } from "mongoose";

export interface T {
	[key: string]: any;
}

export interface StatisticModifier {  // ixtiyory documentni ixtiyoriy collectionni o'zgartirishda xizmat qiladigon interfacedir
	_id: ObjectId;  // ixtiyoriy collection id si
	targetKey: string;  // nimani o'zgartirmoqchimiz(dataset nomi)
	modifier: number;  //qanday qiymatga o'zgartirmoqchimiz
}