export class FontMetricRefreshBinding {
  private refresh: (() => void) | undefined
  private source: FontFaceSet | undefined
  private active = false

  private readonly onLoadingDone = () => {
    if (this.active) this.refresh?.()
  }

  update(refresh: (() => void) | undefined): void {
    this.refresh = refresh
  }

  attach(source: FontFaceSet): () => void {
    this.detach()
    this.source = source
    this.active = true
    source.addEventListener('loadingdone', this.onLoadingDone)
    void source.ready.then(() => {
      if (this.active && this.source === source) this.refresh?.()
    })
    return () => {
      if (this.source === source) this.detach()
    }
  }

  private detach(): void {
    if (this.source) {
      this.source.removeEventListener('loadingdone', this.onLoadingDone)
    }
    this.source = undefined
    this.active = false
  }
}
