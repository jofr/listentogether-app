export class Events {
    _eventListeners: Map<string, ((...args: any[]) => void)[]> = new Map();

    on(eventName: string | string[], eventHandler: (...args: any[]) => void) {
        if (Array.isArray(eventName)) {
            for (let name of eventName) {
                this.on(name, eventHandler);
            }
        } else {
            if (!this._eventListeners.get(eventName)) {
                this._eventListeners.set(eventName, []);
            }
            this._eventListeners.get(eventName).push(eventHandler);
        }
    }

    off(eventName: string, eventHandler: (...args: any[]) => void) {
        if (!this._eventListeners.get(eventName)) {
            return;
        }

        let handlers = this._eventListeners.get(eventName)
        for (let i = 0; i < handlers.length; i++) {
            if (handlers[i] == eventHandler) {
                handlers.splice(i, 1);
                i--;
            }
        }
    }

    emit(eventName: string, ...args: any[]) {
        if (!this._eventListeners.get(eventName)) {
            return;
        }
        
        let handlers = this._eventListeners.get(eventName)
        if (handlers) {
            for (let handler of handlers) {
                handler(...args);
            }
        }
    }
}