# Outreach Console v0.6.0

Version 0.6.0 adds a distinct Amber Console appearance and makes the visual
settings easier to understand before applying them.

## Amber Console

Settings -> Customize now includes **Amber Console**, a framed monochrome theme
with amber readouts, square controls, strong focus outlines, and compact status
treatment. It is an original, dependency-free adaptation inspired by
[DutchDiederik/AmberConsole](https://github.com/DutchDiederik/AmberConsole).

The release does not bundle the AmberConsole stylesheet, JavaScript, or fonts.
This keeps the Lite package small and avoids adding a runtime dependency or
network request.

## Clearer Customization

- Six theme options now include plain-language descriptions and a visible check
  mark for the selected choice.
- A live specimen previews scheduled-message counts, replies, spacing, readiness,
  and review state using the active theme and accent.
- The picker uses two columns in the working console and one column on phones so
  descriptions do not collapse into narrow word stacks.
- The Advanced console's right-side work tabs now use a stable two-column grid,
  preventing long labels such as Troubleshooting from being clipped.

## Compatibility

Existing saved preferences migrate without changes. Terminal remains the default
theme. Amber Console can be selected, exported, imported, reset, and updated like
the other appearance settings.

The interface was checked at 1280 x 720 and 390 x 844, with no horizontal
overflow in the customization surface. All theme options were exercised, the
selected theme survived reload, and the browser console remained free of errors.
