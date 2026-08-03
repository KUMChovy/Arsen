import type { SweetAlertOptions } from 'sweetalert2'

type AlertIcon = 'error' | 'success' | 'warning'
type ConfirmTone = 'acid' | 'danger' | 'purple'

function alertOptions(tone: ConfirmTone = 'purple'): SweetAlertOptions {
  return {
    background: 'var(--color-arsen-surface)',
    buttonsStyling: false,
    color: 'var(--color-arsen-ink)',
    customClass: {
      actions: 'arsen-swal-actions',
      cancelButton: 'arsen-swal-button arsen-swal-cancel',
      confirmButton: `arsen-swal-button arsen-swal-${tone}`,
      container: 'arsen-swal-container',
      htmlContainer: 'arsen-swal-text',
      icon: 'arsen-swal-icon',
      input: 'arsen-swal-input',
      popup: 'arsen-swal-popup',
      title: 'arsen-swal-title',
      validationMessage: 'arsen-swal-validation',
    },
    heightAuto: false,
    reverseButtons: true,
    width: 'min(92vw, 380px)',
  }
}

export async function confirmDanger(title: string, text: string) {
  const Swal = await import('sweetalert2')
  const result = await Swal.default.fire({
    ...alertOptions('danger'),
    cancelButtonText: 'Cancelar',
    confirmButtonText: 'Eliminar',
    icon: 'warning',
    showCancelButton: true,
    text,
    title,
  })

  return result.isConfirmed
}

export async function confirmAction(title: string, text: string, confirmButtonText = 'Continuar') {
  const Swal = await import('sweetalert2')
  const result = await Swal.default.fire({
    ...alertOptions(),
    cancelButtonText: 'Cancelar',
    confirmButtonText,
    icon: 'warning',
    showCancelButton: true,
    text,
    title,
  })

  return result.isConfirmed
}

export async function showAlert(title: string, text: string, icon: AlertIcon = 'success') {
  const Swal = await import('sweetalert2')
  await Swal.default.fire({
    ...alertOptions(icon === 'error' ? 'danger' : 'acid'),
    icon,
    text,
    title,
  })
}
