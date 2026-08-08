import { DOWN, UP } from "@/constants";

export function flipStatus(status: number) {
    if (status === UP) {
        return DOWN;
    }
    if (status === DOWN) {
        return UP;
    }
    return status;
}
