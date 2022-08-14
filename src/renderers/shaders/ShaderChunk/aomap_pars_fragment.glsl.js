export default /* glsl */`
#ifdef USE_AOMAP

	uniform sampler2D aoMap;
	uniform float aoMapIntensity;

#endif

#ifdef USE_DETAILED_AOMAP

	uniform sampler2D detailedAoMap;

#endif
`;
