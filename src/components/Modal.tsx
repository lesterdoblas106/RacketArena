import type { FormEvent, ReactNode } from 'react'

type ModalProps = {
  open: boolean
  title?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  if (!open) return null

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <header className="modal-header">
            <h3>{title}</h3>

            <button
              className="ghost"
              onClick={onClose}
              aria-label="Close modal"
            >
              ×
            </button>
          </header>
        ) : (
          <button
            className="modal-close-floating"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        )}
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
}

export function ModalForm({
  open,
  title,
  onClose,
  onSubmit,
  children,
  submitLabel,
}: ModalFormProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
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
