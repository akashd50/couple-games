import { Injectable } from "@angular/core";
import { BehaviorSubject, shareReplay } from "rxjs";

export interface MenuItem {
    id: string;
    text: string;
    click: () => void;
}

@Injectable({ providedIn: "root" })
export class SettingMenuService {
    private menuItemsSubject = new BehaviorSubject<MenuItem[]>([]);
    public menuItems$ = this.menuItemsSubject.asObservable().pipe(shareReplay({ bufferSize: 1, refCount: true }));

    constructor() {
    }

    addMenuItem(menuItem: MenuItem) {
        const items = this.menuItemsSubject.value;
        items.push(menuItem);
        this.menuItemsSubject.next(items);
    }

    removeMenuItem(id: string) {
        const items = this.menuItemsSubject.value.filter((item) => item.id !== id);
        this.menuItemsSubject.next(items);
    }
}