class PipelineNotConfiguredError(RuntimeError):
    """Raised until the concrete AI pipeline is connected."""


class PipelineNotReadyError(RuntimeError):
    """Raised while the configured model is still loading or failed to load."""


class ExtractionFailedError(RuntimeError):
    """Raised when the configured extractor cannot process an image."""


class GeneratorNotConfiguredError(RuntimeError):
    """Raised when the local SD1.5 generator assets are incomplete."""


class GeneratorNotReadyError(RuntimeError):
    """Raised when the generator cannot be loaded or is unavailable."""


class GenerationFailedError(RuntimeError):
    """Raised when the configured generator cannot create an image."""


class InferenceBusyError(RuntimeError):
    """Raised when the single-GPU inference slot is already occupied."""


class ClassifierNotConfiguredError(RuntimeError):
    """Raised when local ConvNeXtV2 or SigLIP2 assets are incomplete."""


class ClassifierNotReadyError(RuntimeError):
    """Raised when the tattoo classifier cannot be loaded."""


class ClassificationFailedError(RuntimeError):
    """Raised when an uploaded image cannot be classified."""
