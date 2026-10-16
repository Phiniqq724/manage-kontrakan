package expo.modules.scrollreporter

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import expo.modules.ui.ModifierEventDispatcher

const val SCROLL_REPORTER_TYPE = "scrollReporter"

/** Distance to travel in one direction before the direction counts as changed. */
private val DIRECTION_THRESHOLD = 24.dp

/**
 * Same as `verticalScroll()` (optionally disabled), but also tells JS which way the user is
 * scrolling. Only fires when the direction flips (after a small threshold), so
 * the bridge isn't flooded with every scroll frame. Being at the very top
 * always counts as "up".
 */
@Composable
internal fun scrollReporterModifier(
  dispatch: ModifierEventDispatcher,
  enabled: Boolean = true
): Modifier {
  val state = rememberScrollState()
  val currentDispatch by rememberUpdatedState(dispatch)
  val thresholdPx = with(LocalDensity.current) { DIRECTION_THRESHOLD.toPx() }

  LaunchedEffect(state, thresholdPx) {
    var last = state.value
    var travel = 0f
    var reported = "up"

    snapshotFlow { state.value }.collect { value ->
      val delta = (value - last).toFloat()
      last = value
      if (delta == 0f) return@collect

      // Restart the travel count whenever the finger reverses.
      travel = if ((delta > 0) == (travel > 0)) travel + delta else delta

      val direction = when {
        value <= 0 -> "up"
        travel > thresholdPx -> "down"
        travel < -thresholdPx -> "up"
        else -> reported
      }
      if (direction != reported) {
        reported = direction
        currentDispatch(SCROLL_REPORTER_TYPE, mapOf("direction" to direction))
      }
    }
  }

  // `enabled = false` (e.g. while dragging a tile) stops the page scrolling
  // without losing its position.
  return Modifier.verticalScroll(state, enabled = enabled)
}
