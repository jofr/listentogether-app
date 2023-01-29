const printMessage = (method: string, args: any[]) => {
    console[method](...args);
}

export let logger = {
    "debug": (...args: any[]) => printMessage("debug", args),
    "log": (...args: any[]) => printMessage("log", args),
    "warn": (...args: any[]) => printMessage("warn", args),
    "error": (...args: any[]) => printMessage("error", args)
}

if (process.env.NODE_ENV === "production") {
    logger.debug = () => {};
    logger.log = () => {};
}