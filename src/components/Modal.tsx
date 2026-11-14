import { useEffect, useRef, type FormEvent, type ReactNode } from 'react'

type ModalProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  fitMobileKeyboard?: boolean
}

export function Modal({ open, title, onClose, children, footer, fitMobileKeyboard }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !fitMobileKeyboard) return
    const viewport = window.visualViewport
    const overlay = overlayRef.current
    if (!viewport || !overlay) return

    const fitViewport = () => {
      overlay.style.setProperty('--modal-viewport-top', `${viewport.offsetTop}px`)
      overlay.style.setProperty('--modal-viewport-height', `${viewport.height}px`)
    }

    fitViewport()
    viewport.addEventListener('resize', fitViewport)
    viewport.addEventListener('scroll', fitViewport)
    return () => {
      viewport.removeEventListener('resize', fitViewport)
      viewport.removeEventListener('scroll', fitViewport)
    }
  }, [open, fitMobileKeyboard])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className={fitMobileKeyboard ? 'modal-overlay modal-overlay-fit-keyboard' : 'modal-overlay'}
      role="presentation"
      onClick={onClose}
    >
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h3>{title}</h3>
          <button className="ghost" onClick={onClose} aria-label="Close modal">
            x
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </section>
    </div>
  )
}

type ModalFormProps = {
  open: boolean
  title: string
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  children: ReactNode
  submitLabel: string
  fitMobileKeyboard?: boolean
}

export function ModalForm({
  open,
  title,
  onClose,
  onSubmit,
  children,
  submitLabel,
  fitMobileKeyboard,
}: ModalFormProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      fitMobileKeyboard={fitMobileKeyboard}
      footer={
        <>
          <button onClick={onClose}>Cancel</button>
          <button className="primary" type="submit" form="modal-form">
            {submitLabel}
          </button>
        </>
      }
    >
      <form id="modal-form" className="modal-form" onSubmit={onSubmit}>
        {children}
      </form>
    </Modal>
  )
}
