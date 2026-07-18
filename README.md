# TurboWarp TMPose

A TurboWarp extension for camera-based pose recognition using Teachable Machine Pose models.

## Features

- load a Teachable Machine Pose model from its model URL;
- start and stop the camera;
- show the camera preview inside the TurboWarp stage area;
- start and stop continuous recognition;
- report the current pose and confidence scores;
- optionally report time-decayed accumulated pose scores;
- expose startup and model-loading timing measurements;
- report explicit runtime errors instead of silently failing.

Accumulated pose scoring is staged behind the `temporalPoseScoring` feature flag, which is off by default.
When enabled, each recognition update uses
`previous × activeDecayCoefficient^elapsedSeconds + currentProbability × accumulationCoefficient × elapsedSeconds`.
The accumulation coefficient is a per-second rate, and the decay coefficient is the fraction retained after one second.
Decay changes made during recognition apply when recognition is next started.

### Empty `accumulated pose` result

`accumulated pose` returns an empty string (`""`) when no pose has a positive accumulated score.
In that state, `accumulated score` returns `0`.
This can occur before the first usable prediction, immediately after accumulated scores are reset,
after recognition or the camera is stopped, or when no positive contribution has been accumulated
because the accumulation coefficient or all pose probabilities are zero.

There is no separate minimum-confidence threshold for `accumulated pose`.
Any pose with the highest positive accumulated score is returned; “insufficient recognition”
means that every accumulated pose score is exactly zero.

## Blocks

<!-- BEGIN GENERATED BLOCKS -->

### `TMPose version`

Returns the extension version.

| Property | Value |
|---|---|
| Type | REPORTER |
| Opcode | `versionReporter` |

### `set model URL to [URL]`

Sets the Teachable Machine Pose model URL.

| Property | Value |
|---|---|
| Type | COMMAND |
| Opcode | `setModelURL` |
| `URL` | STRING, default: `https://teachablemachine.withgoogle.com/models/XXXX/` |

### `start camera`

Starts the camera and attaches the preview.

| Property | Value |
|---|---|
| Type | COMMAND |
| Opcode | `startCamera` |

### `stop camera`

Stops the camera and prediction loop.

| Property | Value |
|---|---|
| Type | COMMAND |
| Opcode | `stopCamera` |

### `camera is running?`

Reports whether the camera is running.

| Property | Value |
|---|---|
| Type | BOOLEAN |
| Opcode | `isCameraRunning` |

### `show camera preview`

Shows the camera preview.

| Property | Value |
|---|---|
| Type | COMMAND |
| Opcode | `showPreview` |

### `hide camera preview`

Hides the camera preview.

| Property | Value |
|---|---|
| Type | COMMAND |
| Opcode | `hidePreview` |

### `camera preview is visible?`

Reports whether the preview is configured as visible.

| Property | Value |
|---|---|
| Type | BOOLEAN |
| Opcode | `isPreviewVisible` |

### `set camera preview opacity to [OPACITY]`

Sets preview opacity from 0 to 1.

| Property | Value |
|---|---|
| Type | COMMAND |
| Opcode | `setPreviewOpacity` |
| `OPACITY` | NUMBER, default: `0.6` |

### `set camera preview position to [POSITION]`

Sets the preview position on the stage.

| Property | Value |
|---|---|
| Type | COMMAND |
| Opcode | `setPreviewPosition` |
| `POSITION` | STRING, default: `bottom-right`, menu: `positionMenu` |

### `load model`

Loads the configured pose model.

| Property | Value |
|---|---|
| Type | COMMAND |
| Opcode | `loadModel` |

### `model is loaded?`

Reports whether the model is loaded.

| Property | Value |
|---|---|
| Type | BOOLEAN |
| Opcode | `isModelLoaded` |

### `start recognition`

Starts pose recognition.

| Property | Value |
|---|---|
| Type | COMMAND |
| Opcode | `startPredict` |

### `stop recognition`

Stops pose recognition.

| Property | Value |
|---|---|
| Type | COMMAND |
| Opcode | `stopPredict` |

### `recognition is running?`

Reports whether recognition is running.

| Property | Value |
|---|---|
| Type | BOOLEAN |
| Opcode | `isPredicting` |

### `current pose`

Returns the highest-scoring pose label.

| Property | Value |
|---|---|
| Type | REPORTER |
| Opcode | `currentPoseReporter` |

### `confidence`

Returns the confidence of the current pose.

| Property | Value |
|---|---|
| Type | REPORTER |
| Opcode | `scoreReporter` |

### `confidence of [NAME]`

Returns the confidence for a named pose.

| Property | Value |
|---|---|
| Type | REPORTER |
| Opcode | `poseScoreReporter` |
| `NAME` | STRING, default: `jump` |

### `set accumulated pose accumulation [ACCUMULATION] decay [DECAY]`

Sets the accumulation rate per second and the decay retained per second; decay changes apply to the next recognition session.

| Property | Value |
|---|---|
| Type | COMMAND |
| Opcode | `setAccumulatedPoseParameters` |
| Feature flag | `temporalPoseScoring` |
| `ACCUMULATION` | NUMBER, default: `1` |
| `DECAY` | NUMBER, default: `0.9` |

### `reset accumulated pose scores`

Clears all accumulated pose scores.

| Property | Value |
|---|---|
| Type | COMMAND |
| Opcode | `resetAccumulatedPose` |
| Feature flag | `temporalPoseScoring` |

### `accumulated pose`

Returns the pose label with the highest accumulated score, or an empty string when no pose has a positive accumulated score.

| Property | Value |
|---|---|
| Type | REPORTER |
| Opcode | `accumulatedPoseReporter` |
| Feature flag | `temporalPoseScoring` |

### `accumulated score`

Returns the highest accumulated pose score.

| Property | Value |
|---|---|
| Type | REPORTER |
| Opcode | `accumulatedScoreReporter` |
| Feature flag | `temporalPoseScoring` |

### `accumulated score of [NAME]`

Returns the accumulated score for a named pose.

| Property | Value |
|---|---|
| Type | REPORTER |
| Opcode | `accumulatedPoseScoreReporter` |
| Feature flag | `temporalPoseScoring` |
| `NAME` | STRING, default: `jump` |

### `pose is [NAME]?`

Reports whether the named pose has at least 0.75 confidence.

| Property | Value |
|---|---|
| Type | BOOLEAN |
| Opcode | `isPose` |
| `NAME` | STRING, default: `jump` |

### `pose is [NAME] with confidence at least [THRESHOLD]?`

Reports whether the named pose meets the given threshold.

| Property | Value |
|---|---|
| Type | BOOLEAN |
| Opcode | `isPoseWithThreshold` |
| `NAME` | STRING, default: `jump` |
| `THRESHOLD` | NUMBER, default: `0.75` |

### `camera startup time (ms)`

Returns camera startup time in milliseconds.

| Property | Value |
|---|---|
| Type | REPORTER |
| Opcode | `cameraMsReporter` |

### `model load time (ms)`

Returns model load time in milliseconds.

| Property | Value |
|---|---|
| Type | REPORTER |
| Opcode | `modelLoadMsReporter` |

### `first recognition time (ms)`

Returns first prediction time in milliseconds.

| Property | Value |
|---|---|
| Type | REPORTER |
| Opcode | `firstPredictMsReporter` |

### `last error`

Returns the latest recorded error message.

| Property | Value |
|---|---|
| Type | REPORTER |
| Opcode | `lastErrorReporter` |

<!-- END GENERATED BLOCKS -->

## Development

```bash
npm install
npm run check
```

The build produces `dist/tmpose.js`. Load it as an unsandboxed custom extension.

## External libraries

The extension currently loads TensorFlow.js 1.3.1 and Teachable Machine Pose 0.8.3 from jsDelivr at runtime.

## License

MPL-2.0
