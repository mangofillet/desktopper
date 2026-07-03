import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// Vignette + animated film grain, applied after tone mapping.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    varying vec2 vUv;
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32 + fract(uTime));
      return fract(p.x * p.y);
    }
    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      // vignette
      vec2 d = vUv - 0.5;
      float vig = smoothstep(0.95, 0.35, length(d) * 1.35);
      col.rgb *= mix(0.8, 1.0, vig);
      // faint warm lift in the shadows keeps blacks from going dead
      col.rgb += vec3(0.012, 0.008, 0.006) * (1.0 - vig);
      // grain
      col.rgb += (hash(vUv * 40.0) - 0.5) * 0.009;
      gl_FragColor = col;
    }`,
};

export function setupPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.35, // strength
    0.55, // radius
    0.85 // threshold — bulb, screen whites, moon; lit paper stays just under
  );
  composer.addPass(bloom);

  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  return {
    composer,
    setSize: (w, h) => composer.setSize(w, h),
    tick: (t) => {
      grade.uniforms.uTime.value = t % 100;
    },
  };
}
