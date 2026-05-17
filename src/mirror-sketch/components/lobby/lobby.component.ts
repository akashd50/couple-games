import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { GameService } from '../../services/game.service';
import { SocketService } from '../../services/socket.service';

@Component({
    selector: 'ms-lobby',
    standalone: true,
    imports: [FormsModule, RouterLink],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './lobby.component.html',
    styleUrl: './lobby.component.scss',
})
export class LobbyComponent implements OnInit {
    private readonly socket = inject(SocketService);
    private readonly game = inject(GameService);
    private readonly router = inject(Router);

    readonly mode = signal<'menu' | 'join'>('menu');
    readonly joinCode = signal('');
    readonly busy = signal(false);
    readonly errorMsg = signal<string | null>(null);

    ngOnInit(): void {
        this.socket.connect();
    }

    async createRoom(): Promise<void> {
        if (this.busy()) return;
        this.busy.set(true);
        this.errorMsg.set(null);
        const res = await this.socket.createRoom();
        this.busy.set(false);
        if (!res.ok || !res.code || !res.you || !res.state) {
            this.errorMsg.set(res.error ?? 'Could not create room');
            return;
        }
        this.game.setRoom(res.code, res.you, res.state);
        void this.router.navigate(['/mirror-sketch/room', res.code]);
    }

    async joinRoom(): Promise<void> {
        if (this.busy()) return;
        const code = this.joinCode().trim().toUpperCase();
        if (code.length < 4) {
            this.errorMsg.set('Room code must be 4 characters');
            return;
        }
        this.busy.set(true);
        this.errorMsg.set(null);
        const res = await this.socket.joinRoom(code);
        this.busy.set(false);
        if (!res.ok || !res.code || !res.you || !res.state) {
            this.errorMsg.set(res.error ?? 'Could not join room');
            return;
        }
        this.game.setRoom(res.code, res.you, res.state);
        void this.router.navigate(['/mirror-sketch/room', res.code]);
    }

    showJoin(): void {
        this.mode.set('join');
        this.errorMsg.set(null);
    }

    back(): void {
        this.mode.set('menu');
        this.errorMsg.set(null);
        this.joinCode.set('');
    }

    onCodeInput(value: string): void {
        this.joinCode.set(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4));
    }
}
