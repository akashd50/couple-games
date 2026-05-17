import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface GameCard {
    readonly title: string;
    readonly tagline: string;
    readonly emoji: string;
    readonly route: string;
    readonly accent: string;
}

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [RouterLink],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './home.component.html',
    styleUrl: './home.component.scss',
})
export class HomeComponent {
    readonly games: readonly GameCard[] = [
        {
            title: 'Mirror Sketch',
            tagline: 'One describes, the other draws. No peeking.',
            emoji: '🎨',
            route: '/mirror-sketch',
            accent: '#7a5cff',
        },
        {
            title: 'The War Game',
            tagline: 'Run a nation. Trade, build, spy, strike. Solo.',
            emoji: '🌐',
            route: '/thewargame',
            accent: '#d6336c',
        },
        {
            title: 'Sling War',
            tagline: 'Fight each other with slings',
            emoji: '🌐',
            route: '/sling-war',
            accent: '#d6116c',
        },
    ];
}
