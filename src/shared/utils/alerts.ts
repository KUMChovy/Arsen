type AlertIcon = 'error' | 'success' | 'warning'

export async function confirmDanger(title: string, text: string) {
  const Swal = await import('sweetalert2')
  const result = await Swal.default.fire({
    background: 'oklch(0.155 0.016 280)',
    cancelButtonColor: '#52515c',
    cancelButtonText: 'Cancelar',
    color: 'white',
    confirmButtonColor: '#ef4444',
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
    background: 'oklch(0.155 0.016 280)',
    cancelButtonColor: '#52515c',
    cancelButtonText: 'Cancelar',
    color: 'white',
    confirmButtonColor: '#8b5cf6',
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
    background: 'oklch(0.155 0.016 280)',
    color: 'white',
    confirmButtonColor: icon === 'error' ? '#ef4444' : '#8b5cf6',
    icon,
    text,
    title,
  })
}
