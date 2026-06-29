import fs from "fs";

fs.rmSync("./data/playwright-test", {
    recursive: true,
    force: true,
});
