import { AuthLayout } from '@/components/templates/AuthLayout'

export default function Layout({ children }: LayoutProps<'/'>) {
  return <AuthLayout>{children}</AuthLayout>
}
