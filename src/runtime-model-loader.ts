export interface RuntimeModelLoadOptions {
  signal?: AbortSignal;
  parallelModelInitialization?: boolean;
}

export interface RuntimeModelLoaderDependencies {
  ready(): Promise<void>;
  loadClassifier(model: File, weights: File): Promise<unknown>;
  loadMetadata(metadata: File): Promise<unknown>;
  loadPoseNet(): Promise<unknown>;
  createModel(classifier: unknown, poseNet: unknown, metadata: unknown): unknown;
}

type DisposableResource = {
  dispose(): void | Promise<void>;
};

export class TMPoseRuntimeAbortError extends Error {
  readonly code = 'TMPOSE-RUNTIME-ABORTED';

  constructor() {
    super('TMPose runtime model loading was cancelled.');
    this.name = 'AbortError';
  }
}

function abortError(): TMPoseRuntimeAbortError {
  return new TMPoseRuntimeAbortError();
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null;
}

function disposable(value: unknown): DisposableResource | null {
  return isRecord(value) && typeof value.dispose === 'function'
    ? (value as unknown as DisposableResource)
    : null;
}

function validateOptions(value: unknown): RuntimeModelLoadOptions {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new TypeError('TMPose runtime load options must be an object.');
  const signal = value.signal;
  if (
    signal !== undefined &&
    (!isRecord(signal) ||
      typeof signal.aborted !== 'boolean' ||
      typeof signal.addEventListener !== 'function' ||
      typeof signal.removeEventListener !== 'function')
  ) {
    throw new TypeError('TMPose runtime load signal must be an AbortSignal.');
  }
  const parallelModelInitialization = value.parallelModelInitialization;
  if (
    parallelModelInitialization !== undefined &&
    typeof parallelModelInitialization !== 'boolean'
  ) {
    throw new TypeError('parallelModelInitialization must be a boolean.');
  }
  return {
    ...(signal === undefined ? {} : {signal: signal as unknown as AbortSignal}),
    ...(parallelModelInitialization === undefined ? {} : {parallelModelInitialization})
  };
}

async function disposeResources(values: ReadonlyArray<unknown>): Promise<unknown[]> {
  const resources = [...new Set(values.map(disposable).filter((value) => value !== null))];
  const results = await Promise.allSettled(
    resources.map((resource) => Promise.resolve().then(() => resource.dispose()))
  );
  return results.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []));
}

function throwLoadFailure(primaryErrors: unknown[], disposalErrors: unknown[]): never {
  const errors = [...primaryErrors, ...disposalErrors];
  if (errors.length === 1) throw errors[0];
  throw new AggregateError(errors, 'TMPose runtime model loading and cleanup did not complete.');
}

function cancellationAwareErrors(error: unknown, signal?: AbortSignal): unknown[] {
  if (!signal?.aborted || (error as {name?: unknown})?.name === 'AbortError') return [error];
  return [abortError(), error];
}

async function loadSequentially(
  dependencies: RuntimeModelLoaderDependencies,
  model: File,
  weights: File,
  metadata: File,
  signal?: AbortSignal
): Promise<unknown> {
  let classifier: unknown;
  let poseNet: unknown;
  try {
    classifier = await dependencies.loadClassifier(model, weights);
    throwIfAborted(signal);
    const metadataValue = await dependencies.loadMetadata(metadata);
    throwIfAborted(signal);
    poseNet = await dependencies.loadPoseNet();
    throwIfAborted(signal);
    return dependencies.createModel(classifier, poseNet, metadataValue);
  } catch (error) {
    const disposalErrors = await disposeResources([classifier, poseNet]);
    throwLoadFailure(cancellationAwareErrors(error, signal), disposalErrors);
  }
}

function invoke(operation: () => Promise<unknown>): Promise<unknown> {
  try {
    return Promise.resolve(operation());
  } catch (error) {
    return Promise.reject(error);
  }
}

async function loadInParallel(
  dependencies: RuntimeModelLoaderDependencies,
  model: File,
  weights: File,
  metadata: File,
  signal?: AbortSignal
): Promise<unknown> {
  const results = await Promise.allSettled([
    invoke(() => dependencies.loadClassifier(model, weights)),
    invoke(() => dependencies.loadMetadata(metadata)),
    invoke(() => dependencies.loadPoseNet())
  ]);
  const classifier = results[0].status === 'fulfilled' ? results[0].value : undefined;
  const metadataValue = results[1].status === 'fulfilled' ? results[1].value : undefined;
  const poseNet = results[2].status === 'fulfilled' ? results[2].value : undefined;
  const loadErrors = results.flatMap((result) =>
    result.status === 'rejected' ? [result.reason] : []
  );
  if (signal?.aborted || loadErrors.length > 0) {
    const disposalErrors = await disposeResources([classifier, poseNet]);
    throwLoadFailure(
      [...(signal?.aborted ? [abortError()] : []), ...loadErrors],
      disposalErrors
    );
  }
  try {
    return dependencies.createModel(classifier, poseNet, metadataValue);
  } catch (error) {
    const disposalErrors = await disposeResources([classifier, poseNet]);
    throwLoadFailure([error], disposalErrors);
  }
}

export function createRuntimeModelFileLoader(dependencies: RuntimeModelLoaderDependencies) {
  return async function loadFromFiles(
    model: File,
    weights: File,
    metadata: File,
    rawOptions?: RuntimeModelLoadOptions
  ): Promise<unknown> {
    const options = validateOptions(rawOptions);
    throwIfAborted(options.signal);
    await dependencies.ready();
    throwIfAborted(options.signal);
    return options.parallelModelInitialization
      ? loadInParallel(dependencies, model, weights, metadata, options.signal)
      : loadSequentially(dependencies, model, weights, metadata, options.signal);
  };
}
