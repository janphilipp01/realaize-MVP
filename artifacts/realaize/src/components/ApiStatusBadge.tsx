import { useHealthCheck, getHealthCheckQueryKey } from '@workspace/api-client-react';

export default function ApiStatusBadge({ collapsed = false }: { collapsed?: boolean }) {
  const { data, isLoading, isError } = useHealthCheck({
    query: {
      queryKey: getHealthCheckQueryKey(),
      refetchInterval: 15000,
      refetchOnWindowFocus: false,
    },
  });

  const status: 'loading' | 'ok' | 'error' = isLoading
    ? 'loading'
    : isError || data?.status !== 'ok'
      ? 'error'
      : 'ok';

  const color =
    status === 'ok' ? '#34c759' : status === 'loading' ? '#ffcc00' : '#ff3b30';
  const label =
    status === 'ok' ? 'API online' : status === 'loading' ? 'API …' : 'API offline';

  return (
    <div
      title={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: collapsed ? '6px 0' : '6px 14px',
        fontSize: 11,
        color: 'rgba(60,60,67,0.55)',
        fontWeight: 500,
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderTop: '1px solid rgba(0,0,0,0.05)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 0 3px ${color}22`,
          flexShrink: 0,
        }}
      />
      {!collapsed && <span>{label}</span>}
    </div>
  );
}
