export function intHash(str: string, length = 10): number {
    let hash = 0;
    for (let index = 0; index < str.length; index++) {
        hash += str.charCodeAt(index);
    }
    return ((hash % length) + length) % length;
}
