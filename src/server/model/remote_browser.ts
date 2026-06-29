// @ts-nocheck

import { BeanModel } from "@/server/redbean-compat";

class RemoteBrowser extends BeanModel {
    /**
     * Returns an object that ready to parse to JSON
     * @returns {object} Object ready to parse
     */
    toJSON() {
        return {
            id: this.id,
            url: this.url,
            name: this.name,
        };
    }
}

export default RemoteBrowser;
