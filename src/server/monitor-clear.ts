// @ts-nocheck

async function clearWithStoppedMonitors(monitors, clear, restart) {
    const running = monitors.filter((monitor) => Number(monitor.active) === 1);
    let operationError;

    try {
        for (const monitor of running) {
            await monitor.stop();
        }
        await clear();
    } catch (error) {
        operationError = error;
    }

    const restartResults = await Promise.allSettled(running.map((monitor) => restart(monitor)));
    if (operationError) {
        throw operationError;
    }
    const failedRestart = restartResults.find((result) => result.status === "rejected");
    if (failedRestart) {
        throw failedRestart.reason;
    }
}

export { clearWithStoppedMonitors };
