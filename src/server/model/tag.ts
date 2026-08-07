// @ts-nocheck

import { BeanModel } from "@/server/bean-model";

class Tag extends BeanModel {
    /**
     * Return an object that ready to parse to JSON
     * @returns {object} Object ready to parse
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            color: this.color,
        };
    }
}

export default Tag;
