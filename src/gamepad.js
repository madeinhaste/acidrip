// if gamepad.held('left') blah...
// if gamepad.tap('left')
// gamepad.value('left')

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

const GAMEPAD_LEFT = 14;
const GAMEPAD_RIGHT = 15;
const GAMEPAD_UP = 12;
const GAMEPAD_DOWN = 13;

const GAMEPAD_Y = 3;
const GAMEPAD_B = 1;
const GAMEPAD_A = 0;
const GAMEPAD_X = 2;

var wait_for_not_pressed = false;

function gamepad_pressed(gp, i) {
    return gp && gp.buttons[i].pressed;
}

