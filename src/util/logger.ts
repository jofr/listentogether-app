const print = (method: string, args: any[]) => {
    console[method](...args);
}

export const logger = {
    "debug": (...args: any[]) => print("debug", args),
    "log": (...args: any[]) => print("log", args),
    "warn": (...args: any[]) => print("warn", args),
    "error": (...args: any[]) => print("error", args)
}