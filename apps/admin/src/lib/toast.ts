import { toast } from 'sonner';
export const notify = {
  success: (msg: string, options?: any) => toast.success(msg, options),
  error: (msg: string, options?: any) => toast.error(msg, options),
  info: (msg: string, options?: any) => toast.info(msg, options),
  loading: (msg: string, options?: any) => toast.loading(msg, options),
  dismiss: (id?: string | number) => toast.dismiss(id),
  promise: <T>(p: Promise<T>, msgs: { loading: string; success: string; error: string }) =>
    toast.promise(p, msgs),
};