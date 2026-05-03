# CoupleGames

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.4.

## Claude Instructions
Make sure to create memory files in the /memory folder for the conversation. Keep the content clean and concise and organized. It should be efficient so it doesn't waste any extra credits.
Create the memory directory and file if it doesn't exist already.

## Game Ideas
### 1. Mirror Sketch
A creative communication game that should work via Socket.io, connection two players i.e. a couple to play games in a private room

The Mechanic: Player A sees a simple image (e.g., a house with a sun). Player B has a blank canvas. Player A must describe how to draw it using only directional commands, while Player B uses touch gestures to draw.

- At the beginning, one of the two players creates a room and the app will give them with a new room code which can be entered by the second user to join the room. Once joined, players can pick whether they want to be the person drawing or the person describing the scene. The person that needs to describe will then be given a random image form the directory of the images and the person drawing will have a canvas where they can draw. Everything they draw will be shown in real-time to the person describing as well.   

The Fun Factor: Comparing the original image to the "masterpiece" at the end is usually hilarious.

Angular Tip: Use the HTML5 Canvas API within an Angular Directive to handle touch events (touchstart, touchmove) for the drawing interface, use whatever api is good for real-time efficient simple drawings.


### Coding practices
- Clean well-organized code
- Always specify typescript types for all functions and definitions
- Use angular services where applicable for reusability

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
