export default function PermissionNotice({
  title = 'Acesso limitado',
  message,
  variant = 'info',
  compact = false,
  action = null,
}) {
  return (
    <div className={`permission-notice permission-notice-${variant} ${compact ? 'compact' : ''}`} role="status">
      <strong>{title}</strong>
      {message ? <p>{message}</p> : null}
      {action ? <div className="permission-notice-action">{action}</div> : null}
    </div>
  );
}
