'use client'

import * as React from 'react'
import TextField, { type TextFieldProps } from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'

export type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'ref'> & {
  /** Va al `<input>` (compatible con `register()` de react-hook-form). */
  ref?: React.Ref<HTMLInputElement>
}

/** TextField de contraseña con botón para mostrar/ocultar el valor. */
export function PasswordField({ ref, ...rest }: PasswordFieldProps) {
  const [visible, setVisible] = React.useState(false)

  return (
    <TextField
      {...rest}
      inputRef={ref}
      type={visible ? 'text' : 'password'}
      slotProps={{
        ...rest.slotProps,
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                edge="end"
                aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setVisible((v) => !v)}
                onMouseDown={(e) => e.preventDefault()}
              >
                {visible ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  )
}
