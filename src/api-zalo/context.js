const _5_MINUTES = 5 * 60 * 1000;
class CallbacksMap extends Map {
    /**
     * @param ttl Time to live in milliseconds. Default is 5 minutes.
     */
    set(key, value, ttl = _5_MINUTES) {
        setTimeout(() => {
            this.delete(key);
        }, ttl);
        return super.set(key, value);
    }
}
export const appContext = {
    uploadCallbacks: new CallbacksMap(),
    options: {
        selfListen: false,
        checkUpdate: true,
    },
};
