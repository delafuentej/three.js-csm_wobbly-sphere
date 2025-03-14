uniform float uTime;
uniform float uTimeFrequency;
uniform float uPositionFrequency;
uniform float uStrength;

uniform float uWarpTimeFrequency;
uniform float uWarpPositionFrequency;
uniform float uWarpStrength;

attribute vec4 tangent;

varying float vWobble;


#include ../includes/simplexNoise4d.glsl

float getWobble(vec3 position){

    vec3 warpedPosition = position;
    warpedPosition += simplexNoise4d(vec4(
        position * uWarpPositionFrequency,
        uTime * uWarpTimeFrequency
    )) * uWarpStrength;

    return simplexNoise4d(vec4(
    //    position * uPositionFrequency,//xyz
        warpedPosition *  uPositionFrequency,
        uTime * uTimeFrequency //w
    )) * uStrength;
}

void main (){
    vec3 biTangent = cross(normal, tangent.xyz);

    // Neighbours positions
    float shift = 0.01;
    vec3 positionA = csm_Position + tangent.xyz * shift;
    vec3 positionB = csm_Position + biTangent * shift;

    //wobble
   float wobble = getWobble(csm_Position);
   //wobble = smoothstep(0.0, 1.0, wobble);
   csm_Position += wobble * normal;// current vertex positon
    // update position A & B
   positionA += getWobble(positionA) * normal; // neigbour A
   positionB += getWobble(positionB) * normal; // neigbour B

   // we need now the directions from the current vertex to the neighbours (destination - origin)
   // compute the normal
    vec3 toA = normalize(positionA - csm_Position);
    vec3 toB = normalize(positionB - csm_Position);

    csm_Normal = cross(toA, toB); // the default normal

    //varying
    vWobble = wobble / uStrength;
   
}