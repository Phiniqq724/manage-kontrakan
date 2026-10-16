package expo.modules.scrollreporter

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

const val SCROLL_FROM_END_TYPE = "horizontalScrollFromEnd"

/**
 * Same as `horizontalScroll()`, but the scroll origin is the end: the row
 * first shows its right edge and the user scrolls left to see earlier items.
 */
@Composable
internal fun horizontalScrollFromEndModifier(): Modifier =
  Modifier.horizontalScroll(rememberScrollState(), reverseScrolling = true)
