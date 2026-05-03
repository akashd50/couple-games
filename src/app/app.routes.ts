import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'mirror-sketch' },
  {
    path: 'mirror-sketch',
    loadComponent: () =>
      import('../mirror-sketch/components/lobby/lobby.component').then((m) => m.LobbyComponent),
  },
  {
    path: 'mirror-sketch/room/:code',
    loadComponent: () =>
      import('../mirror-sketch/components/room/room.component').then((m) => m.RoomComponent),
  },
  { path: '**', redirectTo: 'mirror-sketch' },
];
