export default /* glsl */`
#if defined(USE_AOMAP) || defined(USE_DETAILED_AOMAP)

	float ambientOcclusion = 1.0;

	#ifdef USE_AOMAP

	// reads channel R, compatible with a combined OcclusionRoughnessMetallic (RGB) texture
	ambientOcclusion *= ( texture2D( aoMap, vUv2 ).r - 1.0 ) * aoMapIntensity + 1.0;

	#endif

	#ifdef USE_DETAILED_AOMAP

	ambientOcclusion *= texture2D( detailedAoMap, vUv ).r;

	#endif

	reflectedLight.indirectDiffuse *= ambientOcclusion;

	#if defined( USE_ENVMAP ) && defined( STANDARD )

		float dotNV = saturate( dot( splitGeoNormal, geometry.viewDir ) );

		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );

	#endif

#endif
`;
