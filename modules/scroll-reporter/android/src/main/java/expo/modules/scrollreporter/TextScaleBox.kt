package expo.modules.scrollreporter

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.ModifierList
import expo.modules.ui.ModifierRegistry
import expo.modules.ui.UIComposableScope

const val TEXT_SCALE_BOX_TYPE = "TextScaleBox"

@OptimizedComposeProps
data class TextScaleBoxProps(
  val scale: Float = 1f,
  val modifiers: ModifierList = emptyList()
) : ComposeProps

/**
 * Scales all text inside it by `scale`, on top of the phone's own font size,
 * by providing a density with an adjusted `fontScale`. Layout sizes in dp are
 * untouched. The Box passes its size constraints straight to the children,
 * so a full-screen page still fills the screen.
 */
@Composable
fun FunctionalComposableScope.TextScaleBoxContent(props: TextScaleBoxProps) {
  val density = LocalDensity.current
  CompositionLocalProvider(
    LocalDensity provides Density(density.density, density.fontScale * props.scale)
  ) {
    Box(
      modifier = ModifierRegistry.applyModifiers(
        props.modifiers,
        appContext,
        composableScope,
        globalEventDispatcher
      ),
      propagateMinConstraints = true
    ) {
      Children(UIComposableScope())
    }
  }
}
