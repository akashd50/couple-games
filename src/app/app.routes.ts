import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('../home/home.component').then((m) => m.HomeComponent),
    },
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
    {
        path: 'thewargame',
        loadComponent: () =>
            import('../thewargame/components/shell/shell.component').then((m) => m.ShellComponent),
    },
    {
        path: 'sling-war',
        loadComponent: () =>
            import('../sling-war/sling-war/sling-war.component').then((m) => m.SlingWarComponent),
    },
    {
        path: 'sling-war-building',
        loadComponent: () =>
            import('../sling-war/sling-war/components/building/building.component').then((m) => m.BuildingComponent),
    },
    {
        path: 'rogue-lite',
        loadComponent: () =>
            import('../rogue-lite/shell/shell.component').then((m) => m.ShellComponent),
    },
    {path: '**', redirectTo: ''},
];
