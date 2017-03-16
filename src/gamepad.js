var gamepad_index = -1;

export function gamepad_init() {
    console.log('gamepad_init');

    function select_gamepad(gamepad) {
        if (gamepad) {
            gamepad_index = gamepad.index;
            console.info(`Gamepad ${gamepad.id} connected at index ${gamepad.index}.`);
        } else {
            gamepad_index = -1;
            console.info(`Gamepad disconnected.`);
        }
    }

    window.addEventListener('gamepadconnected', function(e) {
        if (gamepad_index < 0)
            select_gamepad(e.gamepad);
    });

    window.addEventListener('gamepaddisconnected', function(e) {
        if (e.gamepad.index == gamepad_index)
            select_gamepad(null);
    });

    // scan gamepads
    _.each(navigator.getGamepads(), gamepad => {
        if (gamepad) {
            select_gamepad(gamepad);
            return false;
        }
    });
}

export function gamepad_get() {
    if (gamepad_index < 0)
        return null;

    return navigator.getGamepads()[gamepad_index];
}
