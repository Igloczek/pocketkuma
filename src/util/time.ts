export function parseTimeObject(time: string) {
    if (!time) {
        return { hours: 0, minutes: 0 };
    }

    const values = time.split(":");
    if (values.length < 2) {
        throw new Error("parseVueDatePickerTimeFormat: Invalid Time");
    }

    const result = { hours: parseInt(values[0]), minutes: parseInt(values[1]), seconds: 0 };
    if (values.length >= 3) {
        result.seconds = parseInt(values[2]);
    }
    return result;
}

export function parseTimeFromTimeObject(obj: any) {
    if (!obj) {
        return obj;
    }

    let result = obj.hours.toString().padStart(2, "0") + ":" + obj.minutes.toString().padStart(2, "0");
    if (obj.seconds) {
        result += ":" + obj.seconds.toString().padStart(2, "0");
    }
    return result;
}
