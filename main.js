// global variables
let ctx;
let width, height;
let width_metre, height_metre;

const metre = 10;
const gravity = 9.8; 
const friction = 0.3;
const T = 10;

const ballList = [];
let ropeList = [];

let mouseX = 0;
let mouseY = 0;
let mouseDownX = 0;
let mouseDownY = 0;
let mouseZ = 0;
let mouseDown = false;

const ballType = {
  NORMAL: 1,
  FIXED: 2,
  FOLLOW: 3,
};

window.onload = () => setup();

function setup() {
  const canvas = document.getElementById("simulationArea");
  ctx = canvas.getContext("2d");

  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;

  width_metre = width / metre;
  height_metre = height / metre;

  mouseX = width / 2;
  mouseY = height / 2;

  initialize();

  setInterval(loop, T);
  window.addEventListener("resize", onWindowResize);

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  window.addEventListener("mousedown", (e) => {
    mouseDown = true;
    mouseDownX = e.clientX;
    mouseDownY = e.clientY;
  });

  window.addEventListener("mouseup", () => (mouseDown = false));
  window.addEventListener("mouseleave", () => (mouseDown = false));

  document.addEventListener("keydown", (event) => {
    const key = event.key;
    switch (key) {
      case "ArrowUp":
        mouseZ += 100;
        break;
      case "ArrowDown":
        mouseZ -= 100;
        break;
      case " ":
        throwBallTowardCursor();
        break;
    }
  });
}

function onWindowResize() {
  width = window.innerWidth;
  height = window.innerHeight;
  const canvas = document.getElementById("simulationArea");
  canvas.width = width;
  canvas.height = height;
  width_metre = width / metre;
  height_metre = height / metre;
}

function clearCanvas() {
  ctx.clearRect(0, 0, width, height);
}

function throwBallTowardCursor() {
  const targetX = mouseX;
  const targetY = mouseY;

  const originX_px = mouseX;
  const originY_px = mouseY;

  const dx_px = targetX - originX_px;
  const dy_px = targetY - originY_px;

  const angle = Math.atan2(dy_px, dx_px);
  const speed = 20;

  const vx = speed * Math.cos(angle);
  const vy = speed * Math.sin(angle);

  const b = new Ball(originX_px / metre, originY_px / metre, 0, 0.5);
  b.vx = vx;
  b.vy = vy;
  b.vz = 0;
}

function loop() {
  clearCanvas();

  ballList.forEach((ball) => ball.resetForces());
  ropeList.forEach((rope) => rope.exertForces());
  ballList.forEach((ball) => ball.move(T));

  for (let i = 0; i < ballList.length; i++) {
    const ball1 = ballList[i];
    if (ball1.type === ballType.NORMAL && ball1.mass > 0.05) {
      for (let j = 0; j < ballList.length; j++) {
        const ball2 = ballList[j];
        if (
          ball1 === ball2 ||
          (ball2.type === ballType.NORMAL && ball2.mass > 0.05)
        )
          continue;

        const distance = ball1.distance(ball2);
        const minDistance = ball1.radius_metre + ball2.radius_metre;

        if (distance < minDistance) {
          const overlap = minDistance - distance;
          const normalX = (ball1.x - ball2.x) / distance;
          const normalY = (ball1.y - ball2.y) / distance;
          const normalZ = (ball1.z - ball2.z) / distance;

          if (!ball1.isPinned) {
            ball1.x += normalX * overlap * 0.5;
            ball1.y += normalY * overlap * 0.5;
            ball1.z += normalZ * overlap * 0.5;
          }
          if (!ball2.isPinned) {
            ball2.x -= normalX * overlap * 0.5;
            ball2.y -= normalY * overlap * 0.5;
            ball2.z -= normalZ * overlap * 0.5;
          }

          const dotProduct1 =
            ball1.vx * normalX + ball1.vy * normalY + ball1.vz * normalZ;
          const dotProduct2 =
            ball2.vx * normalX + ball2.vy * normalY + ball2.vz * normalZ;

          const impulse =
            (2 * (dotProduct1 - dotProduct2)) / (ball1.mass + ball2.mass);

          if (!ball1.isPinned) {
            ball1.vx -= impulse * ball2.mass * normalX;
            ball1.vy -= impulse * ball2.mass * normalY;
            ball1.vz -= impulse * ball2.mass * normalZ;
          }
          if (!ball2.isPinned) {
            ball2.vx += impulse * ball1.mass * normalX;
            ball2.vy += impulse * ball1.mass * normalY;
            ball2.vz += impulse * ball1.mass * normalZ;
          }
        }
      }
    }
  }

  ropeList.forEach((rope) => rope.render(ctx));
  ballList.forEach((ball) => ball.render(ctx));

  ropeList = ropeList.filter((rope) => rope.present);
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = 'black';
  ctx.font = '14px Arial';
  ctx.textAlign = 'left';

  const boxX = 5;
  const boxY = 5;
  const boxWidth = 350;
  const boxHeight = 80;
  ctx.strokeStyle = 'gray';
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  ctx.fillStyle = 'black';
  ctx.fillText('• Hold mouse: Attract points', 15, boxY + 20);
  ctx.fillText('• Click & Drag: Cut the net', 15, boxY + 40);
  ctx.fillText('• SPACE: Throw ball', 15, boxY + 60);
  ctx.fillText('• Arrow Up/Down: Change Z-depth', 15, boxY + 75);
}

// --- BALL CLASS ---
class Ball {
  constructor(x, y, z = 0, mass = 0.02, density = 1.0) {
    // Default mass for cloth particles
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.fx = 0;
    this.fy = 0;
    this.fz = 0;
    this.mass = mass;
    this.type = ballType.NORMAL;
    this.density = density;
    this.isPinned = false; // Add isPinned property
    // Calculate radius based on volume. We'll store it as a property for collision detection.
    this.radius_metre = Math.pow(
      (3.0 * this.mass) / (Math.PI * 4.0 * this.density),
      1 / 3.0
    );
    ballList.push(this);
  }

  // CONCEPT: Reset forces and apply constant forces like gravity and mouse attraction.
  resetForces() {
    // Renamed from resetForce to match previous explanations
    this.fx = 0;
    this.fy = gravity * this.mass;
    this.fz = 0;

    const _x = mouseX / metre;
    const _y = mouseY / metre;
    const _z = mouseZ / metre;

    const d_squared =
      (this.x - _x) ** 2 + (this.y - _y) ** 2 + (this.z - _z) ** 2;
    const d = Math.sqrt(d_squared);
    const force = (1000 * this.mass) / (d_squared + 2); // Increased multiplier for stronger mouse pull

    // Apply mouse attraction force if mouse is pressed
    if (mouseDown && d > 0 && this.type !== ballType.FIXED) {
      // Only attract if mouse down and not fixed
      this.fx += (force * (_x - this.x)) / d; // Pull towards mouse
      this.fy += (force * (_y - this.y)) / d;
      this.fz += (force * (_z - this.z)) / d;
    }
  }

  // CONCEPT: Update position and velocity using Euler integration.
  move(t) {
    if (this.type === ballType.FIXED) return; // Fixed balls don't move

    const t_s = t / 1000; // Convert milliseconds to seconds

    // Update velocity
    this.vx += (this.fx / this.mass) * t_s;
    this.vy += (this.fy / this.mass) * t_s;
    this.vz += (this.fz / this.mass) * t_s;

    // Apply friction/damping
    const damping = 1 - friction * t_s;
    this.vx *= damping;
    this.vy *= damping;
    this.vz *= damping;

    // Update position
    this.x += this.vx * t_s;
    this.y += this.vy * t_s;
    this.z += this.vz * t_s;

    // Constraint boundaries (keep balls within screen) - Simple bounce
    if (this.x * metre < 0 || this.x * metre > width) {
      this.vx *= -0.8; // Bounce with some energy loss
      this.x = Math.max(0, Math.min(width, this.x * metre)) / metre; // Clamp position
    }
    if (this.y * metre < 0 || this.y * metre > height) {
      this.vy *= -0.8;
      this.y = Math.max(0, Math.min(height, this.y * metre)) / metre;
    }
    // Basic Z boundary check
    if (this.z < -10 || this.z > 10) {
      // Arbitrary Z bounds
      this.vz *= -0.8;
      this.z = Math.max(-10, Math.min(10, this.z));
    }

    // Handle 'FOLLOW' type (snaps to mouse)
    if (this.type === ballType.FOLLOW) {
      this.x = mouseX / metre;
      this.y = mouseY / metre;
      this.z = mouseZ / metre; // Keep its Z in sync
    }
  }

  // CONCEPT: Draw the ball on the 2D canvas.
  render(ctx) {
    const x_px = this.x * metre;
    const y_px = this.y * metre;

    // Scale radius for rendering based on mass/density for consistency
    const radius_px = this.radius_metre * metre;

    ctx.beginPath();
    // Adjust opacity based on Z-depth for a very rudimentary 3D effect (closer = less transparent)
    const alpha = 1.0 - Math.abs(this.z / 10.0); // Z ranges from approx -10 to 10
    ctx.globalAlpha = Math.max(0.2, alpha); // Ensure it's never fully transparent

    // Different colors/styles for different ball types
    if (this.type === ballType.FIXED) {
      ctx.fillStyle = "rgba(255, 0, 0, " + ctx.globalAlpha + ")"; // Red for fixed
      ctx.arc(x_px, y_px, radius_px * 1.5, 0, 2 * Math.PI); // Slightly larger
      ctx.fill();
    } else if (this.mass > 0.05) {
      // Assuming thrown balls have higher mass
      ctx.fillStyle = "rgba(0, 0, 255, " + ctx.globalAlpha + ")"; // Blue for thrown balls
      ctx.arc(x_px, y_px, radius_px * 2, 0, 2 * Math.PI); // Larger for projectiles
      ctx.fill();
    } else {
      // Cloth particles
      ctx.strokeStyle = "rgba(0, 0, 0, " + ctx.globalAlpha + ")"; // Black outline for cloth
      ctx.arc(x_px, y_px, radius_px, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0; // Reset globalAlpha
  }

  distance(b) {
    return Math.sqrt(
      (this.x - b.x) ** 2 + (this.y - b.y) ** 2 + (this.z - b.z) ** 2
    );
  }

  connect(b, l = 1, e = 2) {
    return new Rope(this, b, l, e);
  }
}

// --- ROPE CLASS ---
class Rope {
  constructor(b1, b2, l, e) {
    this.ball1 = b1;
    this.ball2 = b2;
    this.length = l;
    this.elasticity = e;
    this.present = true;
    ropeList.push(this);
  }

  // CONCEPT: Calculates and applies spring forces, and handles tearing.
  exertForces() {
    if (!this.present) return; // If torn, do nothing

    // --- TEARING OPTION 1: MOUSE-BASED CUTTING ---
    // If the mouse is dragging a line that intersects this rope, we 'tear' it.
    // We'll consider the mouse drag as a 'knife' action.
    if (
      mouseDown &&
      doIntersect(
        { x: this.ball1.x * metre, y: this.ball1.y * metre }, // Convert ball positions to pixel for doIntersect
        { x: this.ball2.x * metre, y: this.ball2.y * metre },
        { x: mouseDownX, y: mouseDownY },
        { x: mouseX, y: mouseY }
      )
    ) {
      this.present = false; // Mark the rope as torn
      return; // Stop processing this rope
    }

    const d = this.ball1.distance(this.ball2); // Current distance between balls

    // If stretched beyond rest length, apply tension
    if (d - this.length > 0) {
      const f = ((d - this.length) * this.elasticity) / this.length; // Force calculation

      // --- TEARING OPTION 2: FORCE-BASED BREAKING ---
      // If the tension force exceeds a certain threshold, the rope breaks.
      const tearThreshold = 100; // Tuned value. Higher means harder to break from stretch.
      if (f > tearThreshold) {
        this.present = false;
        return;
      }

      // Resolve force into components
      const dx = this.ball1.x - this.ball2.x;
      const dy = this.ball1.y - this.ball2.y;
      const dz = this.ball1.z - this.ball2.z;

      // Apply force to balls in opposite directions
      this.ball1.fx -= (f * dx) / d;
      this.ball1.fy -= (f * dy) / d;
      this.ball1.fz -= (f * dz) / d;

      this.ball2.fx += (f * dx) / d;
      this.ball2.fy += (f * dy) / d;
      this.ball2.fz += (f * dz) / d;
    }
  }

  // CONCEPT: Draw the rope as a line on the 2D canvas.
  render(ctx) {
    if (!this.present) return; // Only draw if not torn

    // Adjust opacity based on average Z-depth of connected balls
    const avgZ = (this.ball1.z + this.ball2.z) / 2;
    const alpha = 1.0 - Math.abs(avgZ / 10.0);
    ctx.globalAlpha = Math.max(0.2, alpha);

    ctx.beginPath();
    ctx.moveTo(this.ball1.x * metre, this.ball1.y * metre);
    ctx.lineTo(this.ball2.x * metre, this.ball2.y * metre);
    ctx.strokeStyle = "rgba(0, 0, 0, " + ctx.globalAlpha + ")"; // Semi-transparent black line
    ctx.stroke();
    ctx.globalAlpha = 1.0; // Reset globalAlpha
  }
}

// --- LINE INTERSECTION HELPER FUNCTIONS ---
// Used for mouse-based tearing. These are standard computational geometry algorithms.

function orientation(p, q, r) {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (val === 0) return 0; // Collinear
  return val > 0 ? 1 : 2; // Clockwise or Counterclockwise
}

function doIntersect(p1, q1, p2, q2) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  return o1 !== o2 && o3 !== o4; // General case for intersection
}

// --- INITIALIZATION FUNCTION ---
// Creates the initial cloth grid and pins points.
function initialize() {
  const n = 30; // Number of balls in each row and column for the cloth grid
  const l = 2; // Rest length of each rope in 'metres'
  const elasticity_cloth = 70; // Elasticity for cloth ropes
  const r = 1.2; // Spacing multiplier

  // Calculate offsets to center the cloth on the canvas
  const xOffset = Math.round((width_metre - n * r * l) / 2);
  const yOffset = Math.round((height_metre - n * r * l) / 2);

  const cloth = []; // 2D array to hold cloth Ball objects

  // 1. Create the Ball objects for the cloth
  for (let i = 0; i < n; i++) {
    cloth[i] = [];
    for (let j = 0; j < n; j++) {
      // Cloth particles have a small mass (0.02)
      cloth[i][j] = new Ball(j * l * r + xOffset, i * l * r + yOffset, 0, 0.02);
    }
  }

  // 2. Pin the top corners and center of the cloth
  cloth[0][0].type = ballType.FIXED;
  cloth[0][n - 1].type = ballType.FIXED;
  cloth[0][Math.floor(n / 2)].type = ballType.FIXED;

  // 3. Connect the cloth balls with Rope constraints (structural only for now)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // Connect to ball below
      if (i + 1 < n) cloth[i][j].connect(cloth[i + 1][j], l, elasticity_cloth);
      // Connect to ball to the right
      if (j + 1 < n) cloth[i][j].connect(cloth[i][j + 1], l, elasticity_cloth);
    }
  }

  // Create a 'FOLLOW' ball that is controlled by the mouse
  const followBall = new Ball(mouseX / metre, mouseY / metre, 0, 1);
  followBall.type = ballType.FOLLOW;
}
