import { Component, Template, Reactive, clone } from "mahal";
import BaseFruits from "./base_fruits";


export default class extends BaseFruits {

    @Reactive
    fruits = [];
}

