// The background notification task must be defined before anything else
// loads: a closed app starts headless just to run it.
import "./src/utils/notification-task";
import "expo-router/entry";
