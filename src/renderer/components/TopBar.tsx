import { ReactNode } from 'react';
import './TopBar.css';

export default function TopBar(props: { title: string; right?: ReactNode }) {
  return (
    <header className="gb-topbar">
      <div className="gb-topbar__spacer" />
      <div className="gb-topbar__title">{props.title}</div>
      <div className="gb-topbar__right">{props.right}</div>
    </header>
  );
}
